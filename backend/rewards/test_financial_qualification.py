"""Rewards Batch 13.2: isolated financial and real PostgreSQL race qualifications."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from unittest import skipUnless

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection
from django.test import SimpleTestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from billing.models import Invoice
from payments.models import PaymentGateway, Transaction
from .financial_policy import qualify_reward_discount
from .models import PointEntry, RewardPolicy

User=get_user_model()


class RewardsFinancialGuardTests(SimpleTestCase):
    def sample(self, **changes):
        values={
            "currency":"NGN",
            "price_excluding_tax":Decimal("20000.00"),
            "existing_discounts":Decimal("0.00"),
            "reward_discount":Decimal("1000.00"),
            "supplier_cost":Decimal("13500.00"),
            "gateway_fee":Decimal("400.00"),
            "affiliate_cost":Decimal("400.00"),
        }
        values.update(changes)
        return qualify_reward_discount(**values)

    def test_positive_verified_example_is_an_offline_qualification_only(self):
        r=self.sample()
        self.assertTrue(r.allowed)
        self.assertEqual(r.maximum_reward_ngn,Decimal("1000.00"))
        self.assertEqual(r.post_reward_net_ngn,Decimal("19000.00"))
        self.assertEqual(r.contribution_ngn,Decimal("4700.00"))
        self.assertGreater(r.contribution_margin,Decimal("0.20"))

    def test_tax_cannot_inflate_reward_basis(self):
        # The consumer is responsible for passing the actual tax-exclusive
        # amount; adding VAT to this basis would violate the API contract.
        r=self.sample(price_excluding_tax=Decimal("20000.00"),
                      reward_discount=Decimal("1100.00"))
        self.assertFalse(r.allowed)
        self.assertEqual(r.maximum_reward_ngn,Decimal("1000.00"))

    def test_cash_cap_even_on_large_orders(self):
        r=self.sample(price_excluding_tax=Decimal("120000.00"),
                      reward_discount=Decimal("2501.00"),
                      supplier_cost=Decimal("20000.00"))
        self.assertFalse(r.allowed)
        self.assertEqual(r.maximum_reward_ngn,Decimal("2500.00"))

    def test_supplier_floor_gateway_fee_and_affiliate_liability(self):
        for bad in (
            {"supplier_cost":Decimal("18000.00")},
            {"gateway_fee":Decimal("5000.00")},
            {"affiliate_cost":Decimal("5000.00")},
        ):
            with self.subTest(bad=bad):
                self.assertFalse(self.sample(**bad).allowed)

    def test_existing_coupon_stacking_must_recheck_five_percent(self):
        r=self.sample(existing_discounts=Decimal("5000.00"))
        self.assertEqual(r.maximum_reward_ngn,Decimal("750.00"))
        self.assertFalse(r.allowed)

    def test_reject_unknown_negative_or_approximate_currency_and_cost(self):
        self.assertFalse(self.sample(currency="USD").allowed)
        for kwargs in (
            {"supplier_cost":None},
            {"supplier_cost":Decimal("NaN")},
            {"supplier_cost":Decimal("-1")},
            {"supplier_cost":123},
            {"reward_discount":Decimal("0.0001")},
            {"existing_discounts":Decimal("20000.00")},
        ):
            if kwargs.get("existing_discounts") is not None:
                self.assertFalse(self.sample(**kwargs).allowed)
            else:
                with self.assertRaises(ValueError):
                    self.sample(**kwargs)


@skipUnless(connection.vendor=="postgresql",
            "Concurrent reward grant acceptance requires disposable PostgreSQL")
@override_settings(REWARDS_API_ENABLED=True)
class RewardsPostgresConcurrencyTests(TransactionTestCase):
    reset_sequences=False

    def setUp(self):
        self.admin=User.objects.create_superuser(
            email="reward-race-admin@example.invalid",username="race_admin",
            password="OnlyCI-test-2026!")
        self.owner=User.objects.create_user(
            email="reward-race-owner@example.invalid",username="race_owner",
            password="OnlyCI-test-2026!")
        self.invoice=Invoice.objects.create(
            client=self.owner,total=Decimal("12000.00"),
            subtotal=Decimal("12000.00"),currency="NGN",
            due_date=timezone.now()+timedelta(days=7))
        self.invoice.mark_paid()
        RewardPolicy.objects.create(is_active=True,points_per_ngn=1000)
        gateway=PaymentGateway.objects.create(code="paystack",name="Isolated live-like fixture",
              status="active",test_mode=False)
        Transaction.objects.create(
            client=self.owner,invoice=self.invoice,gateway=gateway,
            reference="unique-reward-race-transaction",
            provider_reference="provider-reward-race",
            amount=Decimal("12000.00"),net_amount=Decimal("12000.00"),
            currency="NGN",status="successful",
            webhook_verified=True,transaction_type="payment")

    def test_parallel_awards_write_exactly_one_entry(self):
        def award(_):
            close_old_connections()
            try:
                client=APIClient()
                client.force_authenticate(user=self.admin)
                response=client.post("/api/rewards/admin/purchases/award/",
                    {"invoice_id":self.invoice.pk},format="json")
                return response.status_code
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=4) as pool:
            statuses=list(pool.map(award, range(8)))
        self.assertEqual(statuses.count(201),1,statuses)
        self.assertEqual(statuses.count(200),7,statuses)
        self.assertEqual(PointEntry.objects.filter(
            event_key=f"paid-invoice:{self.invoice.pk}").count(),1)
        self.assertEqual(PointEntry.objects.get(
            event_key=f"paid-invoice:{self.invoice.pk}").points_delta,12)
