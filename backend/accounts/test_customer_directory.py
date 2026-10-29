"""UI-03: real ORM contract tests for the Admin Customer directory.

Uses Django's isolated test database. Nothing in this module writes Production.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.serializers import CustomerListSerializer
from accounts.views import AdminCustomerListView
from billing.models import Invoice
from services.models import Service
from wallet.models import Wallet


class AdminCustomerDirectoryContractTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_superuser(
            email="directory-admin@example.invalid",
            username="directory_admin",
            password="Directory-Test-Only!2026",
        )
        self.first = User.objects.create_user(
            email="directory-first@example.invalid",
            username="directory_first",
            full_name="Directory First Customer",
            password="Directory-Test-Only!2026",
        )
        self.second = User.objects.create_user(
            email="directory-second@example.invalid",
            username="directory_second",
            full_name="Directory Second Customer",
            password="Directory-Test-Only!2026",
        )
        Wallet.objects.update_or_create(
            user=self.first, defaults={"balance": Decimal("1520.25")}
        )
        Wallet.objects.update_or_create(
            user=self.second, defaults={"balance": Decimal("75.00")}
        )

    def _service(self, owner, suffix):
        return Service.objects.create(
            client=owner,
            label="Directory service " + suffix,
            product_id=1,
            plan_id=1,
            billing_cycle="1mo",
            amount=Decimal("12.00"),
            next_due_date=timezone.now() + timedelta(days=30),
        )

    def _invoice(self, owner, amount, state):
        return Invoice.objects.create(
            client=owner,
            status=state,
            subtotal=amount,
            total=amount,
            due_date=timezone.now() + timedelta(days=7),
        )

    def test_invoice_totals_are_not_multiplied_by_service_joins(self):
        self._service(self.first, "A")
        self._service(self.first, "B")
        self._service(self.second, "C")
        self._invoice(self.first, Decimal("50.25"), "paid")
        self._invoice(self.first, Decimal("25.05"), "unpaid")
        self._invoice(self.second, Decimal("500.00"), "unpaid")

        rows = {
            row.id: row
            for row in AdminCustomerListView().get_queryset().filter(
                pk__in=[self.first.pk, self.second.pk]
            )
        }
        self.assertEqual(rows[self.first.pk].services_count, 2)
        self.assertEqual(rows[self.first.pk].total_invoices, Decimal("75.30"))
        self.assertEqual(rows[self.first.pk].unpaid_invoices, Decimal("25.05"))
        self.assertEqual(rows[self.second.pk].services_count, 1)
        self.assertEqual(rows[self.second.pk].total_invoices, Decimal("500.00"))
        self.assertEqual(rows[self.second.pk].unpaid_invoices, Decimal("500.00"))

    def test_missing_related_rows_produce_zero_not_null(self):
        row = AdminCustomerListView().get_queryset().get(pk=self.first.pk)
        self.assertEqual(row.services_count, 0)
        self.assertEqual(row.total_invoices, Decimal("0.00"))
        self.assertEqual(row.unpaid_invoices, Decimal("0.00"))

    def test_wallet_balances_do_not_trigger_one_query_per_customer(self):
        qs = AdminCustomerListView().get_queryset().filter(
            pk__in=[self.first.pk, self.second.pk]
        )
        with self.assertNumQueries(1):
            data = list(CustomerListSerializer(qs, many=True).data)
        balances = {row["id"]: row["wallet_balance"] for row in data}
        self.assertEqual(Decimal(str(balances[self.first.pk])), Decimal("1520.25"))
        self.assertEqual(Decimal(str(balances[self.second.pk])), Decimal("75.00"))

    def test_customer_search_and_role_authority_are_enforced_by_django(self):
        endpoint = "/api/auth/customers/?search=directory-first"
        anonymous = self.client.get(endpoint)
        self.assertIn(anonymous.status_code, (401, 403))

        self.client.force_authenticate(user=self.first)
        forbidden = self.client.get(endpoint)
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin)
        allowed = self.client.get(endpoint)
        self.assertEqual(allowed.status_code, status.HTTP_200_OK, allowed.data)
        records = (
            allowed.data["results"]
            if isinstance(allowed.data, dict)
            else allowed.data
        )
        self.assertEqual(len(records), 1, allowed.data)
        self.assertEqual(records[0]["id"], self.first.pk)
        self.assertEqual(records[0]["full_name"], "Directory First Customer")
        self.assertNotIn("password", records[0])
