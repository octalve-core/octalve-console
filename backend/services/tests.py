"""Isolated Batch 10 tests: real ownership, recorded usage and renewal authority."""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from billing.models import Invoice
from services.models import Service, ServiceUsage


class CustomerServicesBatch10Tests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user(
            username="batch10_owner", email="batch10-owner@example.invalid",
            password="Test-Pass-B10-only!"
        )
        self.other = User.objects.create_user(
            username="batch10_other", email="batch10-other@example.invalid",
            password="Test-Pass-B10-only!"
        )
        self.due = timezone.now() + timedelta(days=14)
        self.service = Service.objects.create(
            client=self.owner, label="Customer hosting", product_id=1,
            plan_id=1, service_type="hosting", status="active",
            billing_cycle="1mo", amount=Decimal("5000.00"), currency="NGN",
            next_due_date=self.due, domain_name="owned.example.invalid",
        )
        self.foreign = Service.objects.create(
            client=self.other, label="Foreign hosting", product_id=1,
            plan_id=1, status="active", billing_cycle="1mo",
            amount=Decimal("5000.00"), next_due_date=self.due,
            domain_name="foreign.example.invalid",
        )
        self.url = f"/api/services/services/{self.service.pk}/"
        self.renewal = self.url + "renewal-status/"

    def test_service_detail_and_usage_are_owner_scoped(self):
        self.client.force_authenticate(user=self.owner)
        ServiceUsage.objects.create(
            service=self.service, disk_used_mb=250, disk_limit_mb=1000,
            bandwidth_used_mb=10, bandwidth_limit_mb=100,
        )
        detail = self.client.get(self.url)
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data["domain_name"], "owned.example.invalid")
        self.assertIsNotNone(detail.data["current_usage"])
        self.assertEqual(detail.data["current_usage"]["disk_used_mb"], 250)
        for forbidden in ("config", "metadata", "provider_identifier",
                          "provider_package_id", "credentials", "raw_data"):
            self.assertNotIn(forbidden, detail.data)
        self.assertEqual(
            self.client.get(f"/api/services/services/{self.foreign.pk}/").status_code, 404
        )
        self.assertEqual(
            self.client.get(f"/api/services/services/{self.foreign.pk}/usage/").status_code, 404
        )
        self.assertEqual(
            self.client.get(f"/api/services/services/{self.foreign.pk}/renewal-status/").status_code,
            404,
        )

    def test_renewal_never_creates_invoice_from_get(self):
        self.client.force_authenticate(user=self.owner)
        before = Invoice.objects.count()
        result = self.client.get(self.renewal)
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["state"], "request_assistance")
        self.assertIsNone(result.data["invoice_id"])
        self.assertEqual(Invoice.objects.count(), before)

    def test_exact_owner_renewal_invoice_only_and_no_payment_mutation(self):
        self.client.force_authenticate(user=self.owner)
        foreign = Invoice.objects.create(
            client=self.other, total=Decimal("5000.00"),
            due_date=self.due,
            metadata={"type": "renewal", "service_id": self.service.pk},
        )
        other_type = Invoice.objects.create(
            client=self.owner, total=Decimal("5000.00"),
            due_date=self.due, metadata={"type": "order", "service_id": self.service.pk},
        )
        self.assertEqual(self.client.get(self.renewal).data["invoice_id"], None)
        own = Invoice.objects.create(
            client=self.owner, total=Decimal("5000.00"), due_date=self.due,
            metadata={"type": "renewal", "service_id": self.service.pk},
        )
        result = self.client.get(self.renewal)
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["state"], "invoice_ready")
        self.assertEqual(result.data["invoice_id"], own.pk)
        self.assertEqual(own.status, "unpaid")
        own.status = "paid"
        own.save(update_fields=["status"])
        self.assertIsNone(self.client.get(self.renewal).data["invoice_id"])
        self.assertEqual(Invoice.objects.count(), 3)

    def test_renewal_not_exposed_to_staff_anonymous_or_other_client(self):
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get(self.renewal).status_code, 404)
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(self.renewal).status_code, (401, 403))
        self.other.role = "staff"
        self.other.save(update_fields=["role"])
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get(self.renewal).status_code, 404)

    def test_inactive_service_has_no_payment_action(self):
        self.service.status = "terminated"
        self.service.save(update_fields=["status"])
        self.client.force_authenticate(user=self.owner)
        status = self.client.get(self.renewal)
        self.assertEqual(status.status_code, 200)
        self.assertEqual(status.data["state"], "unavailable")
        self.assertIsNone(status.data["invoice_id"])
