"""Real Django authority regression with synthetic Paystack responses only."""
import hashlib
import hmac
import json
from decimal import Decimal
from unittest.mock import patch
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from billing.models import Invoice
from orders.models import Order, OrderItem
from payments.domain_pilot_scope import CART
from payments.models import PaymentGateway, PaymentIntent, WebhookEvent, Transaction
from payments.test_checkout_webhooks import reply
from payments.test_lifecycle import KEY, advance_renewals, consume_public_event, review_historical_events, run_due_work, simulate_refund
from provisioning.models import ProvisioningTask
from services.models import Service, ServiceCredential
from notifications.models import HostingNotice

@override_settings(CLOUD_PUBLIC_DOMAIN_PAYMENT_TEST_ENABLED=True, CLOUD_TEST_LIFECYCLE_ENABLED=True,
    CLOUD_GATEWAY_READBACK_ENABLED=True, CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED=True)
class SandboxLifecycleTests(TestCase):
    def setUp(self):
        User=get_user_model()
        self.owner=User.objects.create_user(username="life-owner",email="life-owner@example.test",
            role="client",email_verified_at=timezone.now())
        self.admin=User.objects.create_superuser(username="life-admin",email="life-admin@example.test",
            password="fixture-password-123!",role="admin",email_verified_at=timezone.now())
        self.gateway=PaymentGateway.objects.create(code="paystack",name="Test",test_mode=True,status="test",
            config={"provider_vault_connection_id":"fixture","provider_vault_version":1})
        self.order=Order.objects.create(client=self.owner,status="pending_payment",currency="NGN",subtotal=Decimal("2000.00"),
            total=Decimal("2000.00"),metadata={CART:{"domains":["example.com"],"public_payment_test":True}})
        for kind,description,amount,months in [("domain","example.com registration","1500.00",12),("hosting","Test hosting fixture","500.00",1)]:
            OrderItem.objects.create(order=self.order,item_type=kind,description=description,
                domain_name="example.com",product_id=0,plan_id=0,billing_cycle_id=0,unit_price=Decimal(amount),
                months=months,cycle_key="1yr" if months==12 else "1mo",
                config={CART:{"state":"awaiting_payment"}} if kind=="domain" else {})
        self.order.refresh_from_db()
        self.invoice=Invoice.create_from_order(self.order,test_marker=CART)
        self.intent=PaymentIntent.objects.create(invoice=self.invoice,client=self.owner,gateway=self.gateway,
            amount=self.invoice.total,currency="NGN",status="pending",reference="OC"+"B"*30,
            expires_at=timezone.now()+timedelta(minutes=30))
        self.secret="sk_test_example_fixture_0123456789"
        self.body=json.dumps({"event":"charge.success","data":{"reference":self.intent.reference,"id":12345}}).encode()
        self.signature=hmac.new(self.secret.encode(),self.body,hashlib.sha512).hexdigest()
        self.packet={"status":True,"data":{"reference":self.intent.reference,"id":12345,"status":"success",
            "domain":"test","amount":200000,"currency":"NGN"}}
    def webhook(self,sig=None):
        return APIClient().generic("POST","/api/payments/webhook/paystack/",self.body,
            content_type="application/json",HTTP_X_PAYSTACK_SIGNATURE=sig or self.signature)
    def confirmed(self):
        with patch.object(PaymentGateway,"get_secret_key",return_value=self.secret),patch("payments.readback.requests.get",return_value=reply(self.packet)) as get:
            result=self.webhook()
            self.assertEqual(result.status_code,200,result.data)
            get.assert_called_once()
        self.order.refresh_from_db()
        self.invoice.refresh_from_db()
        self.intent.refresh_from_db()
        self.assertEqual(self.invoice.status,"void")
        self.assertEqual(self.invoice.amount_paid,0)
        self.assertEqual(self.order.status,"needs_review")
        self.assertEqual(self.intent.status,"completed")
        self.assertTrue(WebhookEvent.objects.get().is_processed)
        self.assertEqual(self.order.metadata[KEY]["payment"]["reference"],self.intent.reference)
        self.assertEqual(len(self.order.metadata[KEY]["items"]),2)
        self.assert_no_live_rows()
    def assert_no_live_rows(self):
        for model in (Transaction,Service,ServiceCredential,ProvisioningTask,HostingNotice):
            self.assertFalse(model.objects.exists(),model.__name__)
    def test_verified_webhook_automatic_lifecycle_and_idempotency(self):
        self.confirmed()
        original=self.order.metadata[KEY]
        with patch.object(PaymentGateway,"get_secret_key",return_value=self.secret),patch("payments.readback.requests.get") as get:
            self.assertEqual(self.webhook().status_code,200)
            get.assert_not_called()
        self.order.refresh_from_db()
        self.assertEqual(self.order.metadata[KEY],original)
        self.assertEqual(WebhookEvent.objects.count(),1)
        self.assert_no_live_rows()
    def test_unsigned_wrong_mode_and_amount_refused_then_recovered(self):
        with patch.object(PaymentGateway,"get_secret_key",return_value=self.secret),patch("payments.readback.requests.get") as get:
            self.assertEqual(self.webhook("forged").status_code,403)
            get.assert_not_called()
        for changes in ({"domain":"live"},{"amount":200001},{"status":"pending"},{"id":98765}):
            packet={"status":True,"data":{**self.packet["data"],**changes}}
            with patch.object(PaymentGateway,"get_secret_key",return_value=self.secret),patch("payments.readback.requests.get",return_value=reply(packet)):
                self.assertEqual(self.webhook().status_code,503)
            self.invoice.refresh_from_db()
            self.assertEqual(self.invoice.status,"unpaid")
            self.assertFalse(WebhookEvent.objects.get().is_processed)
        self.confirmed()
    def test_sandbox_off_and_private_pilot_never_auto_executes(self):
        with patch.object(PaymentGateway,"get_secret_key",return_value=self.secret),patch("payments.readback.requests.get") as get,self.settings(CLOUD_TEST_LIFECYCLE_ENABLED=False):
            self.assertEqual(self.webhook().status_code,200)
            get.assert_not_called()
        self.order.metadata[CART]["public_payment_test"]=False
        self.order.save(update_fields=["metadata"])
        with patch("domains.pilot.registrar") as registrar,patch("payments.readback.requests.get") as get:
            self.assertEqual(consume_public_event(WebhookEvent.objects.get().pk),"ignored")
            registrar.assert_not_called()
            get.assert_not_called()
        self.assert_no_live_rows()
    def test_renewal_refund_admin_scope_and_no_live_writes(self):
        self.confirmed()
        path="/api/payments/admin/test-lifecycle/"
        api=APIClient()
        api.force_authenticate(self.owner)
        payload={"invoice":str(self.invoice.public_id),"action":"renewal_rehearsal","confirm":True}
        self.assertEqual(api.post(path,payload,format="json").status_code,403)
        api.force_authenticate(self.admin)
        self.assertEqual(api.post(path,{**payload,"confirm":False},format="json").status_code,400)
        for _ in range(2):
            result=api.post(path,payload,format="json")
            self.assertEqual(result.status_code,200,result.data)
            self.assertEqual(len(result.data["test_lifecycle"]["renewals"]),2)
        result=api.post(path,{**payload,"action":"refund_rehearsal"},format="json")
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(result.data["test_lifecycle"]["refund"]["status"],"simulated_refund")
        self.assertFalse(advance_renewals(self.invoice.pk,at=timezone.now()+timedelta(days=400)))
        self.assertEqual(api.post(path,payload,format="json").status_code,400)
        self.assertEqual(Invoice.objects.count(),1)
        self.assert_no_live_rows()
    def test_scheduled_work_guard_and_historical_readonly(self):
        path="/api/payments/test-lifecycle/cron/"
        with patch.dict("os.environ",{"CRON_SECRET":"a"*64}):
            self.assertEqual(APIClient().get(path).status_code,401)
            self.assertEqual(APIClient().get(path,HTTP_AUTHORIZATION="Bearer wrong").status_code,401)
            self.confirmed()
            self.assertEqual(APIClient().get(path,HTTP_AUTHORIZATION="Bearer "+"a"*64).status_code,200)
        event=WebhookEvent.objects.get()
        event.is_processed=False
        event.save(update_fields=["is_processed"])
        self.assertEqual(review_historical_events()[0]["classification"],"matching_stored_evidence_requires_audit")
        from audit.models import AuditLog
        with patch.object(PaymentGateway,"get_secret_key",return_value=self.secret),patch(
                "payments.readback.requests.get",return_value=reply(self.packet)) as get:
            result=run_due_work()
            self.assertEqual(result["processed"],0)
            self.assertEqual(result["historical_reconciled"],1)
            self.assertEqual(run_due_work()["historical_reconciled"],0)
            get.assert_called_once()
        event.refresh_from_db()
        self.assertTrue(event.is_processed)
        self.assertTrue(AuditLog.objects.filter(entity_type="HistoricalTestPayment",actor__isnull=True,
            entity_id=str(event.pk),details__source="automatic_server_reconciliation",
            details__fulfillment_authorized=False).exists())
        self.assert_no_live_rows()

    def test_rehearse_existing_processed_test_without_new_charge(self):
        with self.settings(CLOUD_TEST_LIFECYCLE_ENABLED=False),patch.object(PaymentGateway,"get_secret_key",return_value=self.secret):
            self.assertEqual(self.webhook().status_code,200)
        from domains.combined_cart import confirm_payment
        with self.settings(CLOUD_TEST_LIFECYCLE_ENABLED=False),patch.object(PaymentGateway,"get_secret_key",return_value=self.secret),patch("payments.readback.requests.get",return_value=reply(self.packet)):
            confirm_payment(self.order)
        self.order.refresh_from_db()
        self.assertNotIn(KEY,self.order.metadata)
        api=APIClient()
        api.force_authenticate(self.admin)
        path="/api/payments/admin/test-lifecycle/"
        payload={"invoice":str(self.invoice.public_id),"action":"start_rehearsal","confirm":True}
        with patch("payments.readback.requests.get") as readback,patch("payments.hosted_checkout.requests.post") as post:
            first=api.post(path,payload,format="json")
            self.assertEqual(first.status_code,200,first.data)
            repeated=api.post(path,payload,format="json")
            self.assertEqual(repeated.data,first.data)
            readback.assert_not_called()
            post.assert_not_called()
        self.assertEqual(PaymentIntent.objects.count(),1)
        self.assertEqual(Invoice.objects.count(),1)
        self.assert_no_live_rows()

    def test_historical_reconciliation_fresh_readback_and_no_fulfillment(self):
        from audit.models import AuditLog
        self.confirmed()
        event=WebhookEvent.objects.get()
        event.is_processed=False
        event.processed_at=None
        event.save(update_fields=["is_processed","processed_at"])
        # Old combined carts did not store the remote ID; do not backfill it.
        self.order.metadata[CART].pop("payment_remote_id")
        self.order.save(update_fields=["metadata"])
        before=self.order.metadata.copy()
        path="/api/payments/admin/test-lifecycle/"
        api=APIClient()
        api.force_authenticate(self.owner)
        body={"action":"reconcile_historical","event":event.pk,"confirm":True,
              "confirm_password":"fixture-password-123!","totp_code":"123456"}
        self.assertEqual(api.post(path,body,format="json").status_code,403)
        api.force_authenticate(self.admin)
        with patch("providers.connection_stepup.check_mutation"),patch.object(
                PaymentGateway,"get_secret_key",return_value=self.secret),patch(
                "payments.readback.requests.get",return_value=reply(self.packet)) as get:
            result=api.post(path,body,format="json")
            self.assertEqual(result.status_code,200,result.data)
            self.assertEqual(result.data["reconciliation"]["status"],"reconciled")
            get.assert_called_once()
            self.assertEqual(api.post(path,body,format="json").status_code,400)
        event.refresh_from_db()
        self.order.refresh_from_db()
        self.assertTrue(event.is_processed)
        self.assertEqual(self.order.metadata,before)
        self.assertTrue(AuditLog.objects.filter(entity_type="HistoricalTestPayment",
            entity_id=str(event.pk),details__fulfillment_authorized=False).exists())
        self.assert_no_live_rows()

    def test_historical_readback_wrong_remote_id_retains_inbox(self):
        self.confirmed()
        event=WebhookEvent.objects.get()
        event.is_processed=False
        event.save(update_fields=["is_processed"])
        packet={"status":True,"data":{**self.packet["data"],"id":99999}}
        from payments.historical_test_reconciliation import reconcile_historical_test
        from rest_framework.exceptions import ValidationError
        with patch.object(PaymentGateway,"get_secret_key",return_value=self.secret),patch(
                "payments.readback.requests.get",return_value=reply(packet)):
            with self.assertRaises(ValidationError):
                reconcile_historical_test(event.pk,self.admin)
        event.refresh_from_db()
        self.assertFalse(event.is_processed)
        self.assert_no_live_rows()


    def test_historical_webhook_reconciles_without_admin_or_supplier(self):
        from audit.models import AuditLog
        self.confirmed()
        event=WebhookEvent.objects.get()
        event.is_processed=False
        event.processed_at=None
        event.save(update_fields=["is_processed","processed_at"])
        self.order.metadata[CART].pop("payment_remote_id")
        self.order.save(update_fields=["metadata"])
        before=self.order.metadata.copy()
        with patch.object(PaymentGateway,"get_secret_key",return_value=self.secret),patch(
                "payments.readback.requests.get",return_value=reply(self.packet)) as get,patch(
                "domains.pilot.registrar") as registrar:
            self.assertEqual(self.webhook().status_code,200)
            self.assertEqual(self.webhook().status_code,200)
            get.assert_called_once()
            registrar.assert_not_called()
        self.order.refresh_from_db()
        event.refresh_from_db()
        self.assertTrue(event.is_processed)
        self.assertEqual(self.order.metadata,before)
        self.assertEqual(AuditLog.objects.filter(entity_type="HistoricalTestPayment",
            entity_id=str(event.pk),actor__isnull=True).count(),1)
        self.assert_no_live_rows()

    def test_historical_retry_fails_closed_then_recovers_automatically(self):
        from payments.automatic_reconciliation import RETRY_PREFIX
        self.confirmed()
        event=WebhookEvent.objects.get()
        event.is_processed=False
        event.processed_at=None
        event.save(update_fields=["is_processed","processed_at"])
        packet={"status":True,"data":{**self.packet["data"],"id":99999}}
        with patch.object(PaymentGateway,"get_secret_key",return_value=self.secret),patch(
                "payments.readback.requests.get",return_value=reply(packet)):
            self.assertEqual(self.webhook().status_code,503)
        event.refresh_from_db()
        self.assertFalse(event.is_processed)
        self.assertTrue(event.error_message.startswith(RETRY_PREFIX))
        with patch.object(PaymentGateway,"get_secret_key",return_value=self.secret),patch(
                "payments.readback.requests.get",return_value=reply(self.packet)):
            self.assertEqual(run_due_work()["historical_reconciled"],1)
        event.refresh_from_db()
        self.assertTrue(event.is_processed)
        self.assertIsNone(event.error_message)
        self.assert_no_live_rows()

    def test_conflicting_signed_remote_ids_block_new_settlement(self):
        # Store the original signed inbox without running payment consumer.
        with self.settings(CLOUD_TEST_LIFECYCLE_ENABLED=False),patch.object(
                PaymentGateway,"get_secret_key",return_value=self.secret):
            self.assertEqual(self.webhook().status_code,200)
        WebhookEvent.objects.create(gateway=self.gateway,is_verified=True,
            event_type="charge.success",event_id="conflicting-test-remote-id",
            payload={"intent_id":self.intent.pk,"reference":self.intent.reference,"remote_id":"99999"})
        with patch.object(PaymentGateway,"get_secret_key",return_value=self.secret),patch(
                "payments.readback.requests.get",return_value=reply(self.packet)):
            self.assertEqual(self.webhook().status_code,503)
        self.invoice.refresh_from_db()
        self.intent.refresh_from_db()
        self.assertEqual(self.invoice.status,"unpaid")
        self.assertEqual(self.intent.status,"pending")
        self.assertFalse(WebhookEvent.objects.filter(is_processed=True).exists())
        self.assert_no_live_rows()

    @override_settings(CLOUD_SELECTED_DOMAIN_TEST_CHECKOUT_ENABLED=True)
    def test_private_cart_payment_does_not_call_registrar(self):
        self.order.metadata[CART]["public_payment_test"]=False
        self.order.save(update_fields=["metadata"])
        with patch.dict("os.environ",{"CLOUD_DOMAIN_PILOT_CLIENT_ID":str(self.owner.pk)}),patch.object(
                PaymentGateway,"get_secret_key",return_value=self.secret),patch(
                "payments.readback.requests.get",return_value=reply(self.packet)) as get,patch(
                "domains.pilot.registrar") as registrar:
            self.assertEqual(self.webhook().status_code,200)
            get.assert_called_once()
            registrar.assert_not_called()
        self.invoice.refresh_from_db()
        self.intent.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.invoice.status,"void")
        self.assertEqual(self.intent.status,"completed")
        self.assertNotIn(KEY,self.order.metadata)
        self.assertTrue(WebhookEvent.objects.get().is_processed)
        self.assert_no_live_rows()
