"""No worker may infer hosting activation from a completed queue row."""
from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from provisioning.models import ProvisioningTask
from services.models import Service


class ProvisioningCompletionAuthorityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        owner = get_user_model().objects.create_user(
            email="provisioning-task-test@example.test",
            username="tasktest", role="client",
            password="fixture-local-only-password",
        )
        cls.service = Service.objects.create(
            client=owner, product_id=1, plan_id=1, provider_id=3,
            service_type="hosting", status="pending",
            label="Synthetic unpaid/pending service",
            domain_name="example.test", provider_identifier="provider-ref",
            billing_cycle="1mo", amount=Decimal("3000"), currency="NGN",
            next_due_date=timezone.now()+timedelta(days=30),
        )

    def test_mutating_task_completed_does_not_change_provider_or_service_state(self):
        for action in ("provision", "suspend", "unsuspend", "terminate", "change_package", "change_password", "reboot", "start", "stop"):
            with self.subTest(action=action):
                task = ProvisioningTask.objects.create(
                    service=self.service, adapter_type="CpanelAdapter",
                    action=action, status="queued",
                )
                with self.assertRaises(ValueError):
                    task.mark_completed({"success": True, "claimed_provisioned": True})
                task.refresh_from_db()
                self.service.refresh_from_db()
                self.assertEqual(task.status, "queued")
                self.assertEqual(self.service.status, "pending")

    def test_read_only_sync_completion_records_metadata_not_activation(self):
        task = ProvisioningTask.objects.create(
            service=self.service, adapter_type="CpanelAdapter",
            action="sync_usage", status="queued",
        )
        task.mark_completed({"recorded_snapshot": True})
        task.refresh_from_db()
        self.service.refresh_from_db()
        self.assertEqual(task.status, "completed")
        self.assertEqual(task.result_data, {"recorded_snapshot": True})
        self.assertEqual(self.service.status, "pending")
