"""B2.8 reproducible synthetic recovery acceptance, no real credentials."""
import io
import json
from unittest.mock import patch

from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import transaction
from django.test import TestCase, override_settings
from django.utils import timezone

from providers.audit_checkpoint import build_audit_checkpoint
from providers.connection_audit import append_event
from providers.connection_models import IntegrationConnection, IntegrationCredentialVersion
from providers.connection_vault import VaultUnavailable, seal
from providers.recovery_evidence import verify_coherent_review_recovery

VAULT = Fernet.generate_key().decode()
AUDIT = Fernet.generate_key().decode()
RECOVERY = Fernet.generate_key().decode()
CHECKPOINT = Fernet.generate_key().decode()
STEPUP = Fernet.generate_key().decode()

@override_settings(
    CLOUD_PROVIDER_VAULT_KEY=VAULT,
    CLOUD_PROVIDER_VAULT_KEY_ID="synthetic-v1",
    CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON="",
    CLOUD_PROVIDER_AUDIT_KEY=AUDIT,
    CLOUD_PROVIDER_RECOVERY_KEY=RECOVERY,
    CLOUD_PROVIDER_CHECKPOINT_KEY=CHECKPOINT,
    CLOUD_PROVIDER_STEPUP_KEY=STEPUP,
    CLOUD_PROVIDER_CHECKPOINT_SCOPE="octalve-console:synthetic-review-evidence",
    CLOUD_PROVIDER_SNAPSHOT_REVIEW_ENABLED=True,
    CLOUD_PROVIDER_AUDIT_CHECKPOINT_ENABLED=True,
)
class ReviewRecoveryEvidenceTests(TestCase):
    def setUp(self):
        self.actor = get_user_model().objects.create_superuser(
            email="drill@example.invalid", username="drill-admin",
            password="CI-NONFUNCTIONAL-SYNTHETIC-PASSWORD-555",
        )
        with transaction.atomic():
            self.row = IntegrationConnection.objects.create(
                adapter_key="resend", label="Synthetic recovery drill",
                environment="test", public_settings={"sending_domain": "example.invalid"},
            )
            self.original = IntegrationCredentialVersion.objects.create(
                connection=self.row, version=1, key_id="synthetic-v1",
                ciphertext=seal("resend", self.row.pk, 1,
                    {"api_key": "CI-ONLY-NONFUNCTIONAL-FAKE-TOKEN-1234"}),
            )
            append_event(self.row, self.actor, "draft_created", 1)

    def rotate(self):
        with transaction.atomic():
            row = IntegrationConnection.objects.select_for_update().get(pk=self.row.pk)
            self.original.revoked_at = timezone.now()
            self.original.save(update_fields=["revoked_at"])
            IntegrationCredentialVersion.objects.create(
                connection=row, version=2, key_id="synthetic-v1",
                ciphertext=seal("resend", row.pk, 2,
                    {"api_key": "CI-ONLY-NONFUNCTIONAL-FAKE-TOKEN-5678"}),
            )
            row.current_version = 2
            row.save(update_fields=["current_version", "updated_at"])
            append_event(row, self.actor, "credential_rotated", 2)

    def test_drill_is_read_only_and_reports_narrow_scope(self):
        original = self.original.ciphertext
        report = verify_coherent_review_recovery()
        self.assertEqual(report["connections"], 1)
        self.assertEqual(report["credential_versions"], 1)
        self.assertEqual(report["signed_events"], 1)
        self.assertEqual(len(report["snapshot_sha256"]), 64)
        self.assertTrue(report["isolated_sqlite"])
        self.assertFalse(report["full_neon_restore"])
        self.assertFalse(report["external_worm_certified"])
        self.assertFalse(report["production_readiness"])
        self.assertNotIn("CI-ONLY-NONFUNCTIONAL", str(report))
        self.original.refresh_from_db()
        self.assertEqual(self.original.ciphertext, original)
        output = io.StringIO()
        call_command("verify_provider_recovery_evidence",
            "--confirm=VERIFY-ISOLATED-PROVIDER-RECOVERY",
            stdout=output, stderr=io.StringIO())
        self.assertFalse(json.loads(output.getvalue())["production_readiness"])

    def test_snapshot_and_checkpoint_from_different_valid_revisions_rejected(self):
        older_checkpoint = build_audit_checkpoint()
        self.rotate()
        with patch("providers.recovery_evidence.build_audit_checkpoint",
                   return_value=older_checkpoint):
            with self.assertRaises(VaultUnavailable):
                verify_coherent_review_recovery()
        self.assertEqual(verify_coherent_review_recovery()["credential_versions"], 2)

    def test_corrupt_source_and_missing_ciphertext_fail_closed(self):
        self.original.ciphertext = "invalid"
        self.original.save(update_fields=["ciphertext"])
        with self.assertRaises(VaultUnavailable):
            verify_coherent_review_recovery()

    def test_empty_snapshot_evidence_cannot_claim_recovery(self):
        # PostgreSQL has an append-only trigger, so never delete audit rows
        # even in synthetic tests. Substitute a signed-key encrypted empty
        # snapshot and require the coherent evidence gate to reject it.
        empty = Fernet(RECOVERY).encrypt(json.dumps({
            "format": "octalve-vault-recovery-v1", "connections": []
        }).encode())
        with patch("providers.recovery_evidence.build_isolated_snapshot", return_value=empty):
            with self.assertRaises(VaultUnavailable):
                verify_coherent_review_recovery()

    def test_missing_confirmation_and_distinct_keys(self):
        with self.assertRaises(CommandError):
            call_command("verify_provider_recovery_evidence",
                stdout=io.StringIO(), stderr=io.StringIO())
        with override_settings(CLOUD_PROVIDER_AUDIT_CHECKPOINT_ENABLED=False):
            with self.assertRaises(VaultUnavailable):
                verify_coherent_review_recovery()
        with override_settings(CLOUD_PROVIDER_CHECKPOINT_KEY=RECOVERY):
            with self.assertRaises(VaultUnavailable):
                verify_coherent_review_recovery()
