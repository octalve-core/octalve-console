from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase,override_settings
from django.utils import timezone
from billing.models import Invoice
from orders.models import Order
from .models import PaymentGateway,PaymentIntent,Transaction,WebhookEvent
from .live_reconciliation import consume
from .readback import ConfirmedGatewayPayment

@override_settings(CLOUD_LIVE_PAYSTACK_RECONCILIATION_ENABLED=True,CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED=True,
    CLOUD_GATEWAY_READBACK_ENABLED=True,CLOUD_SETTLEMENT_COMMIT_ENABLED=True)
class LiveReconciliationTests(TestCase):
    def setUp(self):
        user=get_user_model().objects.create_user(username="live-fixture",email="live-fixture@example.test",password="FixturePassword123!",role="client")
        order=Order.objects.create(client=user,status="pending_payment",currency="NGN",subtotal=100,total=100)
        self.invoice=Invoice.objects.create(client=user,order=order,currency="NGN",subtotal=100,total=100,due_date=timezone.now()+timedelta(days=7))
        gateway=PaymentGateway.objects.create(code="paystack",name="Synthetic",status="active",test_mode=False,config={"provider_vault_connection_id":"fixture","provider_vault_version":1})
        self.intent=PaymentIntent.objects.create(client=user,invoice=self.invoice,gateway=gateway,status="pending",amount=100,currency="NGN",reference="LIVE_FIXTURE_01",expires_at=timezone.now()+timedelta(minutes=10),metadata={"payment_mode":"live","gateway_binding":gateway.config})
        self.event=WebhookEvent.objects.create(gateway=gateway,event_id="live-fixture-1",event_type="charge.success",is_verified=True,is_processed=False,
            payload={"mode":"live","binding":gateway.config,"intent_id":self.intent.pk,"reference":self.intent.reference,"remote_id":"12345"})
    def test_exact_readback_and_idempotent_ledger(self):
        proof=ConfirmedGatewayPayment("paystack",self.intent.reference,"NGN",Decimal("100"),"12345")
        with patch("payments.live_reconciliation.resolve_live_key",return_value="fixture"),patch("payments.live_binding.resolve_live_key",return_value="fixture"),patch("payments.settlement.verify_gateway_intent",return_value=proof) as read:
            self.assertEqual(consume(self.event.pk),"processed")
            self.assertEqual(consume(self.event.pk),"processed")
            read.assert_called_once()
        self.invoice.refresh_from_db()
        self.event.refresh_from_db()
        self.assertEqual(self.invoice.status,"paid")
        self.assertTrue(self.event.is_processed)
        self.assertEqual(Transaction.objects.filter(invoice=self.invoice).count(),1)
    def test_remote_id_mismatch_never_settles(self):
        proof=ConfirmedGatewayPayment("paystack",self.intent.reference,"NGN",Decimal("100"),"99999")
        with patch("payments.live_reconciliation.resolve_live_key",return_value="fixture"),patch("payments.live_binding.resolve_live_key",return_value="fixture"),patch("payments.settlement.verify_gateway_intent",return_value=proof):
            self.assertEqual(consume(self.event.pk),"held")
        self.assertFalse(Transaction.objects.exists())
    def test_historical_mode_and_binding_are_denied(self):
        self.event.payload={**self.event.payload,"mode":"test"}
        self.event.save(update_fields=["payload"])
        with patch("payments.live_reconciliation.resolve_live_key",return_value="fixture"),patch("payments.settlement.verify_gateway_intent") as read:
            self.assertEqual(consume(self.event.pk),"held")
            read.assert_not_called()
        self.assertFalse(Transaction.objects.exists())

    def test_financial_exception_readback_is_separate_from_settlement(self):
        from .financial_exceptions import consume as consume_exception
        proof=ConfirmedGatewayPayment("paystack",self.intent.reference,"NGN",Decimal("100"),"12345")
        with patch("payments.live_reconciliation.resolve_live_key",return_value="fixture"),patch("payments.live_binding.resolve_live_key",return_value="fixture"),patch("payments.settlement.verify_gateway_intent",return_value=proof):
            self.assertEqual(consume(self.event.pk),"processed")
        refund=WebhookEvent.objects.create(gateway=self.intent.gateway,event_id="refund-fixture",event_type="refund.processed",is_verified=True,
            payload={"mode":"live","binding":self.intent.gateway.config,"case_id":"99","transaction_id":"12345"})
        data={"id":99,"transaction":12345,"domain":"live","status":"processed","amount":5000,"currency":"NGN"}
        with patch("payments.financial_exceptions.resolve_live_key",return_value="fixture"),patch("payments.financial_exceptions.fetch_case",return_value=data) as read:
            self.assertEqual(consume_exception(refund.pk),"processed")
            self.assertEqual(consume_exception(refund.pk),"processed")
            read.assert_called_once()
        original=Transaction.objects.get(invoice=self.invoice)
        self.assertTrue(original.metadata["financial_exception_review_required"])
        self.assertEqual(original.amount,Decimal("100"))
        self.assertEqual(original.status,"successful")
        from provisioning.authority import evaluate_payment_to_provisioning
        self.invoice.refresh_from_db()
        self.assertFalse(evaluate_payment_to_provisioning(self.invoice,original).approved)

    def test_financial_exception_rejects_wrong_remote_identity(self):
        from .financial_exceptions import consume as consume_exception
        event=WebhookEvent.objects.create(gateway=self.intent.gateway,event_id="dispute-fixture",event_type="charge.dispute.create",is_verified=True,
            payload={"mode":"live","binding":self.intent.gateway.config,"case_id":"99","transaction_id":"12345"})
        data={"id":99,"transaction":{"id":99999},"domain":"live","status":"pending","refund_amount":None,"currency":None}
        with patch("payments.financial_exceptions.resolve_live_key",return_value="fixture"),patch("payments.financial_exceptions.fetch_case",return_value=data):
            self.assertEqual(consume_exception(event.pk),"held")
        event.refresh_from_db()
        self.assertFalse(event.is_processed)

    def test_signed_case_replay_after_readback_does_not_change_evidence(self):
        from .financial_exceptions import record_signed
        body={"domain":"live","id":99,"transaction":{"id":12345}}
        with patch("payments.financial_exceptions.resolve_live_key",return_value="fixture"):
            event,created=record_signed(self.intent.gateway,"charge.dispute.create",body)
            self.assertTrue(created)
            event.payload={**event.payload,"verified_case":{"state":"pending"}}
            event.is_processed=True
            event.save(update_fields=["payload","is_processed"])
            replay,created=record_signed(self.intent.gateway,"charge.dispute.create",body)
            self.assertFalse(created)
            self.assertEqual(replay.pk,event.pk)
            self.assertTrue(replay.is_processed)
