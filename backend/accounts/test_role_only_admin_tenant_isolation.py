"""Deny inconsistent role-only Admin identities cross-tenant financial and domain data.

Runs against disposable Django test storage; no gateway, registrar or provider actions.
"""
from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from billing.models import Invoice, Quote
from domains.models import Domain, DNSRecord, SSLCertificate
from payments.models import Transaction, PaymentGateway


class RoleOnlyAdminTenantIsolationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        user = get_user_model()
        cls.owner = user.objects.create_user(
            email="financial-owner@example.invalid", username="financial_owner",
            password="test-only", role="client")
        cls.role_only = user.objects.create_user(
            email="financial-role-only@example.invalid", username="financial_role_only",
            password="test-only", role="admin", is_staff=False)
        now = timezone.now()
        later = now + timedelta(days=365)
        cls.invoice = Invoice.objects.create(
            client=cls.owner, invoice_number="INV-ROLE-ONLY-01", due_date=later,
            total=Decimal("100.00"))
        cls.quote = Quote.objects.create(
            client=cls.owner, quote_number="Q-ROLE-ONLY-01", valid_until=later)
        cls.transaction = Transaction.objects.create(
            client=cls.owner, reference="txn-role-only-test",
            amount=Decimal("100.00"), net_amount=Decimal("100.00"))
        cls.domain = Domain.objects.create(
            client=cls.owner, domain_name="role-only.invalid", tld=".invalid",
            expiry_date=later, next_due_date=later)
        cls.dns = DNSRecord.objects.create(
            domain=cls.domain, record_type="A", name="www", value="192.0.2.1")
        cls.ssl = SSLCertificate.objects.create(
            client=cls.owner, common_name="role-only.invalid",
            expires_at=later, next_due_date=later)
        cls.gateway = PaymentGateway.objects.create(
            code="paystack", name="Test-only payment gateway", status="test")

    def test_global_finance_and_domain_lists_do_not_leak(self):
        api = APIClient()
        api.force_authenticate(user=self.role_only)
        endpoints = (
            "/api/billing/invoices/", "/api/billing/quotes/",
            "/api/domains/domains/", "/api/domains/dns-records/",
            "/api/domains/ssl-certificates/", "/api/payments/transactions/",
        )
        for endpoint in endpoints:
            with self.subTest(endpoint=endpoint):
                response = api.get(endpoint)
                self.assertEqual(response.status_code, 200)
                rows = (response.data.get("results", [])
                        if isinstance(response.data, dict) else response.data)
                self.assertEqual(len(rows), 0)

    def test_cross_tenant_details_404_and_gateway_config_403(self):
        api = APIClient()
        api.force_authenticate(user=self.role_only)
        paths = (
            f"/api/billing/invoices/{self.invoice.pk}/",
            f"/api/billing/quotes/{self.quote.pk}/",
            f"/api/domains/domains/{self.domain.pk}/",
            f"/api/domains/dns-records/{self.dns.pk}/",
            f"/api/domains/ssl-certificates/{self.ssl.pk}/",
            f"/api/payments/transactions/{self.transaction.pk}/",
        )
        for endpoint in paths:
            with self.subTest(endpoint=endpoint):
                self.assertEqual(api.get(endpoint).status_code, 404)
        self.assertEqual(api.get("/api/payments/gateways/").status_code, 403)
        self.assertEqual(api.get("/api/billing/invoices/templates/").status_code, 403)
