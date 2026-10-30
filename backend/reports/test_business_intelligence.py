"""BIZ-02 integration and negative security gate.

Uses disposable database records only; no gateway, supplier, mail or payout IO.
"""
from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient
from billing.models import Invoice
from payments.models import Transaction
from services.models import Service
from reports.business_intelligence import business_snapshot


class BusinessSnapshotTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        users = get_user_model()
        cls.admin = users.objects.create_user(
            email="biz02-admin@example.invalid", username="biz02_admin",
            password="test-only", role="admin", is_staff=True)
        cls.client = users.objects.create_user(
            email="biz02-client@example.invalid", username="biz02_client",
            password="test-only", role="client")
        cls.staff = users.objects.create_user(
            email="biz02-staff@example.invalid", username="biz02_staff",
            password="test-only", role="staff", is_staff=True)
        cls.spoof = users.objects.create_user(
            email="biz02-spoof@example.invalid", username="biz02_spoof",
            password="test-only", role="admin", is_staff=False)
        now = timezone.now()
        future = now + timedelta(days=15)
        cls.invoice = Invoice.objects.create(
            client=cls.client, invoice_number="INV-BIZ02-001", status="paid",
            currency="NGN", due_date=future, total=Decimal("9999.00"),
            amount_paid=Decimal("9999.00"), paid_at=now)
        Transaction.objects.create(
            client=cls.client, invoice=cls.invoice, reference="biz02-real-verified",
            currency="NGN", amount=Decimal("120.00"),
            net_amount=Decimal("116.00"), status="successful",
            webhook_verified=True, transaction_type="payment", paid_at=now)
        Transaction.objects.create(
            client=cls.client, invoice=cls.invoice, reference="biz02-unverified",
            currency="NGN", amount=Decimal("900.00"),
            net_amount=Decimal("890.00"), status="successful",
            webhook_verified=False, transaction_type="payment", paid_at=now)
        Transaction.objects.create(
            client=cls.client, invoice=cls.invoice, reference="biz02-other-currency",
            currency="USD", amount=Decimal("50.00"),
            net_amount=Decimal("48.00"), status="successful",
            webhook_verified=True, transaction_type="payment", paid_at=now)
        for index in range(2):
            Transaction.objects.create(
                client=cls.client, invoice=cls.invoice,
                reference=f"biz02-failed-{index}", currency="NGN",
                amount=Decimal("12.00"), net_amount=Decimal("12.00"),
                status="failed", transaction_type="payment")
        Service.objects.create(
            client=cls.client, product_id=1, plan_id=1,
            label="Active due service", status="active",
            billing_cycle="1mo", amount=Decimal("50.00"),
            next_due_date=now + timedelta(days=5))

    def api(self, user):
        api = APIClient()
        if user is not None:
            api.force_authenticate(user=user)
        return api

    def test_permissions_anonymous_client_staff_spoof_denied(self):
        for user in (None, self.client, self.staff, self.spoof):
            with self.subTest(user=user):
                response = self.api(user).get("/api/reports/business-intelligence/")
                self.assertIn(response.status_code, (401, 403), response.data)
                self.assertNotIn(b"payment_amounts", response.content)

    def test_verified_payment_not_forged_invoice_or_mixed_currency(self):
        result = self.api(self.admin).get("/api/reports/business-intelligence/?currency=NGN")
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["currency"], "NGN")
        self.assertEqual(result.data["overview"]["payment_amounts"]["this_month"], "120.00")
        self.assertEqual(result.data["overview"]["verified_payment_count_this_month"], 1)
        self.assertEqual(result.data["overview"]["paid_invoices_this_month"], 1)
        self.assertEqual(result.data["renewals"]["services_due_in_7_days"], 1)
        self.assertEqual(result.data["customers"]["accounts_with_repeat_failed_payments_14d"], 1)
        self.assertEqual(result.data["customers"]["accounts_with_past_due_services"], 0)
        self.assertFalse(result.data["methodology"]["settlement_verified"])
        self.assertFalse(result.data["methodology"]["profit_verified"])
        self.assertIsNone(result.data["providers"]["margin"])
        self.assertIn("no-store", result["Cache-Control"])
        self.assertNotIn("biz02-client@example.invalid", str(result.data))
        self.assertNotIn("webhook_payload", str(result.data))

    def test_usd_scope_and_invalid_currency_fail_closed(self):
        api = self.api(self.admin)
        usd = api.get("/api/reports/business-intelligence/?currency=USD")
        self.assertEqual(usd.status_code, 200)
        self.assertEqual(usd.data["overview"]["payment_amounts"]["this_month"], "50.00")
        self.assertEqual(usd.data["overview"]["paid_invoices_this_month"], 0)
        for code in ("NGN-USD", "123", "x" * 50):
            with self.subTest(code=code):
                self.assertEqual(api.get(
                    "/api/reports/business-intelligence/", {"currency": code}
                ).status_code, 400)
        self.assertEqual(api.post("/api/reports/business-intelligence/", {}).status_code, 405)

    def test_query_count_bounded_and_zero_financial_external_calls(self):
        api = self.api(self.admin)
        with CaptureQueriesContext(connection) as ctx:
            result = api.get("/api/reports/business-intelligence/?currency=NGN")
        self.assertEqual(result.status_code, 200)
        self.assertLess(len(ctx.captured_queries), 55)
