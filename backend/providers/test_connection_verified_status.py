"""Evidence-backed Connection Store status; vendor operations remain disabled.

Existing Production INT-02 successful provider_connection_test receipts should
be picked up without a data migration, without repeating MFA or resaving tokens.
"""
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from audit.models import AuditLog
from providers.connection_models import IntegrationConnection
from providers.connection_status import verification_receipts,safe_verification_status
from providers.connection_views import safe_connection


class ProviderVerifiedStatusTests(TestCase):
    def setUp(self):
        self.owner=get_user_model().objects.create_superuser(
            email="connection-status@example.invalid",
            username="connection_status",
            password="Only_For_CI_2026_Verified_Status",
            email_verified_at=timezone.now(),
        )
        self.connection=IntegrationConnection.objects.create(
            adapter_key="cloudflare-dns",label="Octalve DNS",
            environment="live",
            public_settings={"zone_id":"a"*32,"account_id":"b"*32},
            state="draft",current_version=1,created_by=self.owner,
        )
        self.api=APIClient()
        self.api.force_authenticate(user=self.owner)

    def receipt(self, *,key=None,adapter="cloudflare-dns",version=1,
                verified=True,read_only=True,execution_enabled=False):
        return AuditLog.objects.create(
            actor=self.owner,
            action="provider_connection_test",
            entity_type="IntegrationConnection",
            entity_id=key if key is not None else str(self.connection.pk),
            entity_name=adapter,
            details={
                "adapter":adapter,
                "credential_version":version,
                "verified":verified,
                "read_only":read_only,
                "execution_enabled":execution_enabled,
                "checked_at":timezone.now().isoformat(),
            }
        )

    def status(self):
        return safe_verification_status(self.connection,
            verification_receipts([self.connection]))

    def test_existing_successful_audit_receipt_is_visible_without_resaving_token(self):
        self.assertEqual(self.status()["verification_status"],"awaiting_verification")
        response=self.api.get("/api/providers/connections/")
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(response.data["results"][0]["verification_status"],"awaiting_verification")
        self.receipt()
        result=self.api.get("/api/providers/connections/")
        self.assertEqual(result.status_code,200,result.data)
        entry=result.data["results"][0]
        self.assertEqual(entry["verification_status"],"verified")
        self.assertIsInstance(entry["last_verified_at"],str)
        self.assertFalse(entry["execution_enabled"])
        self.assertNotIn("api_token",str(entry))
        detail=self.api.get(f"/api/providers/connections/{self.connection.pk}/")
        self.assertEqual(detail.status_code,200,detail.data)
        self.assertEqual(detail.data["verification_status"],"verified")

    def test_another_adapter_uuid_or_credential_version_never_counts(self):
        self.receipt(key=str(self.connection.pk),version=2)
        self.receipt(adapter="brevo")
        self.receipt(key="00000000-0000-0000-0000-000000000001")
        self.assertEqual(self.status()["verification_status"],"awaiting_verification")
        self.receipt()
        self.assertEqual(self.status()["verification_status"],"verified")
        self.connection.current_version=2
        self.connection.updated_at=timezone.now()
        self.connection.save(update_fields=["current_version","updated_at"])
        self.assertEqual(self.status()["verification_status"],"awaiting_verification")

    def test_never_use_unauthorized_or_failed_receipt_as_approval(self):
        self.receipt(verified=False)
        self.receipt(read_only=False)
        self.receipt(execution_enabled=True)
        self.assertEqual(self.status()["verification_status"],"awaiting_verification")
        self.receipt()
        self.assertEqual(self.status()["verification_status"],"verified")
        self.connection.state="revoked"
        self.connection.save(update_fields=["state"])
        result=self.status()
        self.assertEqual(result["verification_status"],"revoked")
        self.assertIsNone(result["last_verified_at"])

    def test_old_receipt_is_historical_and_never_a_current_verified_claim(self):
        row=self.receipt()
        AuditLog.objects.filter(pk=row.pk).update(
            created_at=timezone.now()-timedelta(days=10))
        result=self.status()
        self.assertEqual(result["verification_status"],"recheck_required")
        self.assertIsNotNone(result["last_verified_at"])
        AuditLog.objects.filter(pk=row.pk).update(
            created_at=timezone.now()-timedelta(days=200))
        self.assertEqual(self.status()["verification_status"],"awaiting_verification")

    def test_status_never_confers_supplier_write_authority(self):
        self.receipt()
        response=safe_connection(self.connection,verification_receipts([self.connection]))
        self.assertEqual(response["verification_status"],"verified")
        self.assertFalse(response["execution_enabled"])
        self.assertEqual(self.connection.state,"draft")
