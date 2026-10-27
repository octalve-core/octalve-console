"""Batch 11: read-only domain registration/renewal/transfer authority gates."""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from billing.models import Invoice
from .models import Domain, DNSRecord, DomainNameserver, TLDPricing


class CustomerDomainManagementTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(
            username="batch11_owner", email="batch11-owner@example.invalid",
            password="Synthetic-Only-B11-2026!"
        )
        self.other = User.objects.create_user(
            username="batch11_other", email="batch11-other@example.invalid",
            password="Synthetic-Only-B11-2026!"
        )
        self.future = timezone.now() + timedelta(days=180)
        self.domain = Domain.objects.create(
            client=self.owner, domain_name="owned.example.com",
            tld=".com", status="active", expiry_date=self.future,
            next_due_date=self.future, epp_code="SHOULD-NEVER-BE-DISCLOSED",
            metadata={"provider_token": "SHOULD-NEVER-BE-DISCLOSED"},
            dnssec_key="SHOULD-NEVER-BE-DISCLOSED",
        )
        self.foreign = Domain.objects.create(
            client=self.other, domain_name="foreign.example.com", tld=".com",
            expiry_date=self.future, next_due_date=self.future,
        )
        DNSRecord.objects.create(
            domain=self.domain, name="www", record_type="A",
            value="203.0.113.10", ttl=3600,
        )
        DomainNameserver.objects.create(
            domain=self.domain, hostname="ns1.example.invalid",
        )
        self.base = f"/api/domains/domains/{self.domain.pk}/"

    def test_customer_exact_domain_details_no_internal_metadata(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(self.base)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["domain_name"], self.domain.domain_name)
        self.assertEqual(len(response.data["dns_records"]), 1)
        self.assertEqual(len(response.data["nameservers"]), 1)
        for field in ("epp_code", "epp_code_encrypted", "dnssec_key",
                      "provider_domain_id", "provider", "metadata"):
            self.assertNotIn(field, response.data)
        self.assertNotIn("SHOULD-NEVER-BE-DISCLOSED", str(response.data))
        for route in ("", "dns_records/", "nameservers/", "renewal-status/"):
            self.assertEqual(
                self.client.get(f"/api/domains/domains/{self.foreign.pk}/" + route).status_code,
                404,
            )

    def test_customer_domain_mutations_fail_closed(self):
        self.client.force_authenticate(user=self.owner)
        before_dns = DNSRecord.objects.count()
        before_invoice = Invoice.objects.count()
        before_expiry = self.domain.expiry_date
        for action, body in (
            ("renew/", {"years": 1}),
            ("create_dns_record/", {"record_type": "A", "name": "new", "value": "192.0.2.1"}),
            ("delete_dns_record/", {"record_id": 1}),
            ("update_nameservers/", {"nameservers": ["ns2.example.invalid"]}),
        ):
            response = self.client.post(self.base + action, body, format="json")
            self.assertEqual(response.status_code, 503, (action, response.data))
        self.assertEqual(DNSRecord.objects.count(), before_dns)
        self.assertEqual(Invoice.objects.count(), before_invoice)
        self.domain.refresh_from_db()
        self.assertEqual(self.domain.expiry_date, before_expiry)

    def test_owner_renewal_status_only_for_exact_existing_invoice(self):
        self.client.force_authenticate(user=self.owner)
        url = self.base + "renewal-status/"
        initial = self.client.get(url)
        self.assertEqual(initial.status_code, 200, initial.data)
        self.assertEqual(initial.data["state"], "request_assistance")
        self.assertIsNone(initial.data["invoice_id"])
        wrong_client = Invoice.objects.create(
            client=self.other, total=Decimal("2500.00"), due_date=self.future,
            metadata={"type": "domain_renewal", "domain_id": self.domain.pk},
        )
        wrong_type = Invoice.objects.create(
            client=self.owner, total=Decimal("2500.00"), due_date=self.future,
            metadata={"type": "order", "domain_id": self.domain.pk},
        )
        self.assertIsNone(self.client.get(url).data["invoice_id"])
        own = Invoice.objects.create(
            client=self.owner, total=Decimal("2500.00"), due_date=self.future,
            metadata={"type": "domain_renewal", "domain_id": self.domain.pk},
        )
        selected = self.client.get(url)
        self.assertEqual(selected.data["state"], "invoice_ready")
        self.assertEqual(selected.data["invoice_id"], own.pk)
        own.status = "paid"
        own.save(update_fields=["status"])
        self.assertIsNone(self.client.get(url).data["invoice_id"])
        self.assertEqual(Invoice.objects.count(), 3)
        self.assertEqual(self.domain.status, "active")

    def test_transfer_preflight_no_epp_persistence_or_availability_claim(self):
        TLDPricing.objects.create(
            tld=".com", register_price=Decimal("5000.00"),
            transfer_price=Decimal("6000.00"), renewal_price=Decimal("7000.00"),
        )
        self.client.force_authenticate(user=self.owner)
        url = "/api/domains/domains/transfer-readiness/"
        before = Domain.objects.count()
        ok = self.client.get(url, {"domain": "Example.COM"})
        self.assertEqual(ok.status_code, 200, ok.data)
        self.assertEqual(ok.data["domain"], "example.com")
        self.assertEqual(ok.data["indicative_price"], "6000.00")
        self.assertIsNone(ok.data["transfer_eligible"])
        self.assertFalse(ok.data["registrar_connected"])
        self.assertFalse(ok.data["checkout_enabled"])
        self.assertEqual(Domain.objects.count(), before)
        for value in ("https://example.com", "example.com/path", "test", "a..com"):
            self.assertEqual(self.client.get(url, {"domain": value}).status_code, 400)
        self.assertEqual(
            self.client.post("/api/domains/search/transfer/",
                             {"domain_name": "example.com", "epp_code": "secret"},
                             format="json").status_code,
            503,
        )
        self.assertEqual(Domain.objects.count(), before)

    def test_staff_and_anonymous_cannot_probe_customer_domain(self):
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(self.base+"renewal-status/").status_code, (401, 403))
        self.other.role = "staff"
        self.other.save(update_fields=["role"])
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get(self.base+"renewal-status/").status_code, 404)
        self.assertEqual(
            self.client.get("/api/domains/domains/transfer-readiness/", {"domain":"example.com"}).status_code,
            404,
        )
