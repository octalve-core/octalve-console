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
