"""No-money, no-network authority regression tests."""
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from django.test import SimpleTestCase
from provisioning.authority import evaluate_payment_to_provisioning, require_verified_settlement, SettlementNotVerified


class PaymentAuthorityContractTests(SimpleTestCase):
    def records(self):
        now = datetime.now(timezone.utc)
        gateway = SimpleNamespace(code='paystack', status='active', test_mode=False)
        order = SimpleNamespace(client_id=7, status='paid', paid_at=now, currency='NGN')
        invoice = SimpleNamespace(pk=42, order=order, client_id=7, status='paid',
            paid_at=now, currency='NGN', amount_due=Decimal('0'), amount_paid=Decimal('20000'),
            total=Decimal('20000'))
        payment = SimpleNamespace(invoice_id=42, client_id=7, transaction_type='payment',
            status='successful', webhook_verified=True, paid_at=now, gateway=gateway,
            currency='NGN', amount=Decimal('20000'),
            metadata={'verification_source':'signed_webhook_and_api_verification'})
        return invoice, payment

    def test_verified_full_settlement_qualifies_only_as_future_worker_input(self):
        inv, tx = self.records()
        self.assertTrue(evaluate_payment_to_provisioning(inv, tx).approved)

    def test_unverified_or_underpaid_payments_cannot_qualify(self):
        for field, value in [
            ('webhook_verified',False), ('status','pending'), ('amount',Decimal('19000')),
            ('currency','USD'), ('invoice_id',9),
        ]:
            inv, tx = self.records()
            setattr(tx,field,value)
            with self.subTest(field=field):
                self.assertFalse(evaluate_payment_to_provisioning(inv,tx).approved)
                with self.assertRaises(SettlementNotVerified):
                    require_verified_settlement(inv,tx)

    def test_invoice_paid_flag_alone_cannot_qualify(self):
        inv,tx=self.records()
        tx.metadata={}
        self.assertFalse(evaluate_payment_to_provisioning(inv,tx).approved)
        tx.metadata={'verification_source':'signed_webhook_and_api_verification'}
        inv.amount_due=Decimal('100')
        self.assertFalse(evaluate_payment_to_provisioning(inv,tx).approved)

    def test_test_mode_manual_and_inactive_gateways_cannot_auto_provision(self):
        for code,status,test_mode in [
            ('manual','active',False), ('paystack','test',True),
            ('flutterwave','inactive',False),
        ]:
            inv,tx=self.records()
            tx.gateway=SimpleNamespace(code=code,status=status,test_mode=test_mode)
            with self.subTest(gateway=code):
                self.assertFalse(evaluate_payment_to_provisioning(inv,tx).approved)
