from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from billing.models import Invoice
from domains.models import Domain
from settings_registry.models import Setting, SettingGroup


class Batch12CustomerNoticesTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            email="notify-owner@example.invalid", username="notify_owner",
            password="Synthetic-Not-Production-2026!"
        )
        self.other = User.objects.create_user(
            email="notify-foreign@example.invalid", username="notify_foreign",
            password="Synthetic-Not-Production-2026!"
        )
        self.now = timezone.now()
        self.bill = Invoice.objects.create(
            client=self.user, total=Decimal("3500.00"),
            due_date=self.now + timedelta(days=3),
        )
        self.foreign_bill = Invoice.objects.create(
            client=self.other, total=Decimal("8900.00"),
            due_date=self.now + timedelta(days=2),
        )
        self.domain = Domain.objects.create(
            client=self.user, domain_name="notify-owned.example.com",
            tld=".com", status="active",
            expiry_date=self.now + timedelta(days=8),
            next_due_date=self.now + timedelta(days=8),
        )
        Domain.objects.create(
            client=self.other, domain_name="private-foreign.example.com",
            tld=".com", status="active",
            expiry_date=self.now + timedelta(days=2),
            next_due_date=self.now + timedelta(days=2),
        )
        self.client.force_authenticate(self.user)

    def test_inbox_realtime_scoped_and_no_financial_side_effects(self):
        before = Invoice.objects.count()
        first = self.client.get("/api/notifications/inbox/")
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(len(first.data["items"]), 2)
        self.assertEqual(first.data["unread_count"], 2)
        self.assertFalse(first.data["delivery"]["email_reminders_enabled"])
        self.assertNotIn("private-foreign.example.com", str(first.data))
        self.assertNotIn(str(self.foreign_bill.invoice_number), str(first.data))
        self.assertEqual(Invoice.objects.count(), before)
        self.assertEqual(self.user.metadata, {})

    def test_mark_read_is_atomic_scoped_and_idempotent(self):
        inbox = self.client.get("/api/notifications/inbox/").data
        key = next(x["key"] for x in inbox["items"] if x["kind"] == "invoice")
        self.assertEqual(self.client.post("/api/notifications/read/", {"key": key}, format="json").status_code, 200)
        self.assertEqual(self.client.post("/api/notifications/read/", {"key": key}, format="json").status_code, 200)
        after = self.client.get("/api/notifications/inbox/").data
        self.assertEqual(after["unread_count"], 1)
        self.user.refresh_from_db()
        self.assertEqual(len(self.user.metadata["console_notices_v1"]["read"]), 1)
        forbidden = f"invoice:{self.foreign_bill.pk}:{self.foreign_bill.due_date.date()}"
        self.assertEqual(
            self.client.post("/api/notifications/read/", {"key": forbidden}, format="json").status_code, 404
        )
        self.assertEqual(
            self.client.post("/api/notifications/read/", {"key": "bad"}, format="json").status_code, 404
        )

    def test_paid_invoice_disappears_even_when_previously_read(self):
        key = next(x["key"] for x in self.client.get("/api/notifications/inbox/").data["items"]
                   if x["kind"] == "invoice")
        self.client.post("/api/notifications/read/", {"key": key}, format="json")
        self.bill.status = "paid"
        self.bill.save(update_fields=["status"])
        data = self.client.get("/api/notifications/inbox/").data
        self.assertEqual(len(data["items"]), 1)
        self.assertFalse(any(x["kind"] == "invoice" for x in data["items"]))
        self.assertEqual(self.bill.status, "paid")

    def test_preferences_boolean_validation_and_persistence(self):
        url = "/api/notifications/preferences/"
        self.assertTrue(self.client.get(url).data["show_login_alerts"])
        self.assertEqual(
            self.client.patch(url, {"show_login_alerts": False, "domain_alerts": False}, format="json").status_code, 200
        )
        self.assertFalse(self.client.get(url).data["domain_alerts"])
        for payload in ({"domain_alerts": "false"}, {"unknown": True}, {"invoice_alerts": None}, {}):
            self.assertEqual(self.client.patch(url, payload, format="json").status_code, 400)
        self.assertFalse(self.client.get(url).data["show_login_alerts"])

    def test_other_tenant_cannot_read_or_write_another_account(self):
        self.client.force_authenticate(self.other)
        data = self.client.get("/api/notifications/inbox/").data
        self.assertEqual(data["unread_count"], 2)
        self.assertNotIn("notify-owned.example.com", str(data))
        self.client.patch("/api/notifications/preferences/", {"invoice_alerts": False}, format="json")
        self.user.refresh_from_db()
        self.assertEqual(self.user.metadata, {})
        self.other.role = "staff"
        self.other.save(update_fields=["role"])
        self.assertEqual(self.client.get("/api/notifications/inbox/").status_code, 404)
        self.assertEqual(self.client.get("/api/notifications/community/").status_code, 404)
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get("/api/notifications/inbox/").status_code, (401, 403))

    def test_unapproved_community_links_are_not_published(self):
        self.assertEqual(
            self.client.get("/api/notifications/community/").data["links"],
            {"whatsapp": None, "telegram": None},
        )
        group = SettingGroup.objects.create(key="general", name="General")
        whatsapp = Setting.objects.create(
            group=group, key="ocloud_whatsapp_channel", name="O-Cloud WhatsApp",
            value="https://evil.example/phishing", is_public=True,
        )
        telegram = Setting.objects.create(
            group=group, key="ocloud_telegram_channel", name="O-Cloud Telegram",
            value="https://t.me/octalvecloud", is_public=True,
        )
        result = self.client.get("/api/notifications/community/").data["links"]
        self.assertIsNone(result["whatsapp"])
        self.assertEqual(result["telegram"], "https://t.me/octalvecloud")
        whatsapp.value = "https://whatsapp.com/channel/0029VaExampleLink"
        whatsapp.save(update_fields=["value"])
        self.assertEqual(
            self.client.get("/api/notifications/community/").data["links"]["whatsapp"],
            whatsapp.value,
        )
        telegram.is_public = False
        telegram.save(update_fields=["is_public"])
        self.assertIsNone(self.client.get("/api/notifications/community/").data["links"]["telegram"])
