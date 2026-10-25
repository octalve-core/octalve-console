"""Synthetic, isolated full funnel through financial settlement and outbox.

Never charges a card, calls a vendor, provisions a hosting account, or opens
OPanel. Database tests prove the high-risk authority transitions remain safe.
"""
import json
from datetime import timedelta
from decimal import Decimal
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from billing.models import Invoice
from orders.models import Order, OrderItem
from payments.models import PaymentGateway, PaymentIntent, Transaction
from payments.settlement import SettlementRefused, settle_verified_intent
from providers.models import Provider
from provisioning.fulfillment import FulfillmentRefused, stage_paid_order
from provisioning.reconcile import ReconciliationRefused, reconcile_verified_hosting
from opanel_bridge.models import VerifiedHostingBinding
from provisioning.models import ProvisioningTask
from services.models import Service
from opanel_bridge.policy import eligible


def vendor_payment(payload, status=200):
    out = Mock(status_code=status, headers={})
    out.raw.read.return_value = json.dumps(payload).encode()
    return out


@override_settings(CLOUD_GATEWAY_READBACK_ENABLED=True,
                   CLOUD_SETTLEMENT_COMMIT_ENABLED=True,
                   CLOUD_FULFILLMENT_STAGING_ENABLED=True)
class PaidHostingFunnelTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(
            email="funnel@example.test", username="funnelexample", role="client",
            password="synthetic-fixture-only-not-real")
        self.provider = Provider.objects.create(
            name="Approved mock WHM", adapter_type="CpanelAdapter",
            base_url="https://whm.synthetic-provider.test:2087",
            status="active", health_status="healthy",
            test_mode=False, username="resellerapi",
            config={"hosting_account_owner": "resellerops"},
        )
        self.gateway = PaymentGateway.objects.create(
            code="paystack", name="Mock Paystack",
            status="active", test_mode=False,
        )
        self.order = Order.objects.create(
            client=user, currency="NGN", status="pending_payment",
            total=Decimal("0"), source="web",
        )
        self.item = OrderItem.objects.create(
            order=self.order, product_id=1, plan_id=1, billing_cycle_id=1,
            item_type="hosting", description="Verified Hosting Starter",
            domain_name="verified.example.test", quantity=1,
            unit_price=Decimal("2500.00"), subtotal=Decimal("2500.00"),
            cycle_key="1mo", months=1,
            config={"catalog_offer_snapshot": {
                "revision": 1, "plan_id": 1, "currency": "NGN",
                "supplier_provider_id": self.provider.pk,
                "technical_package_id": "verified_starter",
                "price": "2500.00", "setup_fee": "0.00",
                "billing_period": "1mo",
            }},
        )
        self.order.refresh_from_db()
        self.invoice = Invoice.create_from_order(self.order)
        self.intent = PaymentIntent.objects.create(
            invoice=self.invoice, client=user, gateway=self.gateway,
            reference="OLPAY_TEST_12345", amount=self.invoice.total,
            currency="NGN", status="pending",
            expires_at=timezone.now()+timedelta(hours=1),
        )
        self.getter = Mock(return_value=vendor_payment({
            "status": True, "data": {
                "id": 987654321, "domain": "live", "status": "success",
                "reference": self.intent.reference,
                "currency": "NGN", "amount": 250000,
            },
        }))
        self.token = patch.object(PaymentGateway, "get_secret_key",
                                  return_value="sk_live_FixtureOnly_0123456789abcdef")
        self.token.start()
        self.addCleanup(self.token.stop)

    def test_full_verified_payment_stages_once_without_activating_or_provisioning(self):
        tx, created = settle_verified_intent(self.intent.pk, getter=self.getter)
        self.assertTrue(created)
        self.assertEqual(tx.metadata["verification_source"], "provider_api_verified")
        self.assertFalse(tx.webhook_verified)
        self.invoice.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.invoice.status, "paid")
        self.assertEqual(self.order.status, "paid")
        first = stage_paid_order(self.order.pk)
        second = stage_paid_order(self.order.pk)
        self.assertEqual(len(first), 1)
        self.assertEqual(first[0][0].pk, second[0][0].pk)
        self.assertEqual(first[0][1].pk, second[0][1].pk)
        service, task = first[0]
        self.assertEqual(service.status, "pending")
        self.assertIsNone(service.provider_identifier)
        self.assertIsNone(service.activated_at)
        self.assertEqual(task.status, "queued")
        self.assertEqual(task.lock_key, f"paid-hosting:order-item:{self.item.pk}:v1")
        self.assertEqual(ProvisioningTask.objects.filter(action="provision").count(), 1)
        self.assertEqual(Service.objects.count(), 1)
        self.assertIsNone(eligible(self.order.client_id, service.pk))
        with self.assertRaises(ValueError):
            task.mark_completed({"provider": "200 OK"})
        service.refresh_from_db()
        self.assertEqual(service.status, "pending")
        # Exactly-once financial delivery: duplicates return the original
        # locked transaction and never issue another gateway HTTP GET.
        second_tx, created_again = settle_verified_intent(self.intent.pk, getter=self.getter)
        self.assertFalse(created_again)
        self.assertEqual(second_tx.pk, tx.pk)
        self.assertEqual(self.getter.call_count, 1)
        self.assertEqual(Transaction.objects.count(), 1)

    def test_outbox_requires_genuine_payment_evidence_and_does_not_accept_paid_flags(self):
        self.invoice.status = "paid"
        self.invoice.amount_paid = self.invoice.total
        self.invoice.paid_at = timezone.now()
        self.invoice.save(update_fields=["status", "amount_paid", "paid_at"])
        self.order.status = "paid"
        self.order.paid_at = timezone.now()
        self.order.save(update_fields=["status", "paid_at"])
        with self.assertRaises(FulfillmentRefused):
            stage_paid_order(self.order.pk)
        self.assertEqual(Service.objects.count(), 0)

    def test_stale_or_mismatched_gateway_response_refused_without_db_write(self):
        self.getter.return_value = vendor_payment({
            "status": True, "data": {
                "id": 12, "domain": "live", "status": "success",
                "reference": "wrong", "currency": "NGN", "amount": 250000,
            },
        })
        with self.assertRaises(Exception):
            settle_verified_intent(self.intent.pk, getter=self.getter)
        self.invoice.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.invoice.status, "unpaid")
        self.assertEqual(self.order.status, "pending_payment")
        self.assertFalse(Transaction.objects.exists())

    def test_unpublished_or_inconsistent_package_snapshot_cannot_stage(self):
        settle_verified_intent(self.intent.pk, getter=self.getter)
        self.item.config = {"catalog_offer_snapshot": {
            **self.item.config["catalog_offer_snapshot"], "price": "2.00"}}
        self.item.save(update_fields=["config"])
        with self.assertRaises(FulfillmentRefused):
            stage_paid_order(self.order.pk)
        self.assertFalse(Service.objects.exists())

    def test_expired_gateway_intent_and_disabled_staging(self):
        self.intent.expires_at = timezone.now()-timedelta(seconds=1)
        self.intent.save(update_fields=["expires_at"])
        with self.assertRaises(Exception):
            settle_verified_intent(self.intent.pk, getter=self.getter)
        with override_settings(CLOUD_FULFILLMENT_STAGING_ENABLED=False):
            with self.assertRaises(FulfillmentRefused):
                stage_paid_order(self.order.pk)

    def test_unsafe_wallet_payment_shortcut_is_disabled_without_debit_or_settlement(self):
        from rest_framework.test import APIClient
        api = APIClient()
        api.force_authenticate(self.order.client)
        reply = api.post(f"/api/billing/invoices/{self.invoice.pk}/pay_with_wallet/")
        self.assertEqual(reply.status_code, 503)
        self.invoice.refresh_from_db()
        self.order.refresh_from_db()
        self.assertEqual(self.invoice.status, "unpaid")
        self.assertEqual(self.order.status, "pending_payment")
        self.assertFalse(Transaction.objects.exists())

    def test_unhealthy_provider_cannot_be_staged(self):
        settle_verified_intent(self.intent.pk, getter=self.getter)
        self.provider.health_status = "unhealthy"
        self.provider.save(update_fields=["health_status"])
        with self.assertRaises(FulfillmentRefused):
            stage_paid_order(self.order.pk)
        self.assertFalse(ProvisioningTask.objects.exists())

    @override_settings(CLOUD_PROVISIONING_WORKER_ENABLED=True,
                       OPANEL_READBACK_ENABLED=True,
                       OPANEL_ISSUER_ENABLED=True,
                       OPANEL_CLIENT_SECRET="synthetic-opanel-secret-0123456789abcdef",
                       OPANEL_CLIENT_ID="octalve-opanel",
                       OPANEL_CALLBACK_URL="https://panel.example.test/auth/callback/")
    def test_provider_reconciliation_then_opanel_customer_launch(self):
        import base64
        import hashlib
        from rest_framework.test import APIClient
        payment, _ = settle_verified_intent(self.intent.pk, getter=self.getter)
        service, task = stage_paid_order(self.order.pk)[0]
        account = task.payload["expected_account"]
        provider_reply = {
            "metadata": {"result": 1}, "data": {"acct": [{
                "user": account, "domain": "verified.example.test",
                "owner": "resellerops", "suspended": 0,
            }]}
        }
        reply = Mock(status_code=200, headers={}, content=json.dumps(provider_reply).encode())
        reply.json.return_value = provider_reply
        getter = Mock(return_value=reply)
        with patch.dict("os.environ", {"CLOUD_INVENTORY_ALLOWED_HOSTS": "whm.synthetic-provider.test"}):
            with patch.object(Provider, "get_api_key", return_value="provider-test-key"):
                # Dry run never creates a service authority.
                reconcile_verified_hosting(task.pk, getter=getter)
                service.refresh_from_db()
                self.assertEqual(service.status, "pending")
                self.assertFalse(VerifiedHostingBinding.objects.exists())
                reconcile_verified_hosting(task.pk, getter=getter, apply=True)
        service.refresh_from_db()
        self.order.refresh_from_db()
        task.refresh_from_db()
        self.assertEqual(service.status, "active")
        self.assertEqual(service.provider_identifier, account)
        self.assertEqual(task.status, "completed")
        self.assertEqual(self.order.status, "provisioned")
        self.assertIsNotNone(eligible(service.client_id, service.pk))
        self.assertEqual(VerifiedHostingBinding.objects.count(), 1)
        with self.assertRaises(ReconciliationRefused):
            reconcile_verified_hosting(task.pk, getter=getter, apply=True)
        # The existing Console issuer grants OPanel only after that proof.
        verifier = "x" * 50
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        api = APIClient()
        api.force_authenticate(self.order.client)
        path = "/api/integrations/opanel/v1/"
        issued = api.post(path + "authorize/", {
            "service_id": service.pk, "state": "s" * 32,
            "code_challenge": challenge,
        }, format="json")
        self.assertEqual(issued.status_code, 200, getattr(issued, "data", {}))
        anonymous = APIClient()
        exchanged = anonymous.post(path + "exchange/", {
            "code": issued.data["code"], "code_verifier": verifier,
            "redirect_uri": "https://panel.example.test/auth/callback/",
        }, format="json",
            HTTP_X_OPANEL_CLIENT_ID="octalve-opanel",
            HTTP_AUTHORIZATION="Bearer synthetic-opanel-secret-0123456789abcdef")
        self.assertEqual(exchanged.status_code, 200, getattr(exchanged, "data", {}))
        self.assertEqual(exchanged.data["service_id"], service.pk)

    @override_settings(CLOUD_PROVISIONING_WORKER_ENABLED=True, OPANEL_READBACK_ENABLED=True)
    def test_provider_account_wrong_reseller_cannot_activate_or_create_opanel_proof(self):
        settle_verified_intent(self.intent.pk, getter=self.getter)
        service, task = stage_paid_order(self.order.pk)[0]
        wrong = {"metadata": {"result": 1}, "data": {"acct": [{
            "user": task.payload["expected_account"],
            "domain": "verified.example.test",
            "owner": "other-reseller", "suspended": 0,
        }]}}
        reply = Mock(status_code=200, content=json.dumps(wrong).encode())
        reply.json.return_value = wrong
        with patch.dict("os.environ", {"CLOUD_INVENTORY_ALLOWED_HOSTS": "whm.synthetic-provider.test"}):
            with patch.object(Provider, "get_api_key", return_value="provider-test-key"):
                with self.assertRaises(ReconciliationRefused):
                    reconcile_verified_hosting(task.pk, getter=Mock(return_value=reply), apply=True)
        service.refresh_from_db()
        self.assertEqual(service.status, "pending")
        self.assertIsNone(service.provider_identifier)
        self.assertFalse(VerifiedHostingBinding.objects.exists())
