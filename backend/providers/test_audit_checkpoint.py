"""B2.7 signed checkpoints detect a full, internally consistent database rollback."""
import io
import json
import os
import stat
import tempfile
import uuid

from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import transaction
from django.test import TestCase, override_settings

from providers.audit_checkpoint import (
    MAX_CHECKPOINT_BYTES, _sign, build_audit_checkpoint, verify_audit_checkpoint,
)
from providers.connection_audit import append_event, verify_chain
from providers.connection_models import IntegrationConnection, IntegrationConnectionEvent
from providers.connection_vault import VaultUnavailable

AUDIT = Fernet.generate_key().decode()
CHECKPOINT = Fernet.generate_key().decode()
VAULT = Fernet.generate_key().decode()
STEPUP = Fernet.generate_key().decode()
RECOVERY = Fernet.generate_key().decode()


@override_settings(
    CLOUD_PROVIDER_AUDIT_KEY=AUDIT, CLOUD_PROVIDER_CHECKPOINT_KEY=CHECKPOINT,
    CLOUD_PROVIDER_VAULT_KEY=VAULT, CLOUD_PROVIDER_STEPUP_KEY=STEPUP,
    CLOUD_PROVIDER_RECOVERY_KEY=RECOVERY,
    CLOUD_PROVIDER_AUDIT_CHECKPOINT_ENABLED=True,
)
class ProviderAuditCheckpointTests(TestCase):
    def setUp(self):
        self.actor = get_user_model().objects.create_superuser(
            email="checkpoint@example.invalid", username="checkpoint-admin",
            password="CI-only-provider-checkpoint-password-456",
        )
        self.row = IntegrationConnection.objects.create(
            adapter_key="resend", label="Synthetic checkpoint",
            environment="test", public_settings={"sending_domain": "example.invalid"},
        )
        self.append("draft_created", 1)

    def append(self, action, version):
        with transaction.atomic():
            row = IntegrationConnection.objects.select_for_update().get(pk=self.row.pk)
            append_event(row, self.actor, action, version)
        self.row.refresh_from_db()

    def test_checkpoint_contains_no_secrets_and_allows_newer_valid_events(self):
        artifact = build_audit_checkpoint()
        self.assertIsInstance(artifact, bytes)
        self.assertNotIn(b"example.invalid", artifact)
        self.assertNotIn(AUDIT.encode(), artifact)
        self.assertEqual(verify_audit_checkpoint(artifact)["verified_checkpoint_connections"], 1)
        self.append("credential_rotated", 2)
        result = verify_audit_checkpoint(artifact)
        self.assertEqual(result["current_connections"], 1)
        self.assertTrue(result["integrity_verified"])

    def test_full_consistent_history_rollback_is_detected(self):
        self.append("credential_rotated", 2)
        artifact = build_audit_checkpoint()
        event1 = IntegrationConnectionEvent.objects.get(connection=self.row, sequence=1)
        # A privileged rollback can restore both the DB head and earlier
        # event rows; the preexisting in-DB signature still verifies.
        IntegrationConnectionEvent.objects.filter(connection=self.row, sequence=2).delete()
        IntegrationConnection.objects.filter(pk=self.row.pk).update(
            audit_sequence=1, audit_head=event1.event_mac, current_version=1,
        )
        self.row.refresh_from_db()
        self.assertEqual(verify_chain(self.row)["events"], 1)
        with self.assertRaises(VaultUnavailable):
            verify_audit_checkpoint(artifact)

    def test_missing_connection_and_missing_prior_event_fail(self):
        artifact = build_audit_checkpoint()
        IntegrationConnectionEvent.objects.filter(connection=self.row).delete()
        IntegrationConnection.objects.filter(pk=self.row.pk).delete()
        with self.assertRaises(VaultUnavailable):
            verify_audit_checkpoint(artifact)

    def test_new_unsequenced_connection_after_export_refuses_verification(self):
        artifact = build_audit_checkpoint()
        IntegrationConnection.objects.create(
            adapter_key="resend", label="Unsequenced new record",
            environment="test", public_settings={"sending_domain": "example.invalid"},
        )
        with self.assertRaises(VaultUnavailable):
            verify_audit_checkpoint(artifact)

    def test_forged_body_and_even_resigned_duplicate_ids_fail(self):
        artifact = build_audit_checkpoint()
        envelope = json.loads(artifact)
        envelope["payload"]["connections"][0]["head"] = "0" * 64
        forged = json.dumps(envelope).encode()
        with self.assertRaises(VaultUnavailable):
            verify_audit_checkpoint(forged)
        original = json.loads(artifact)
        original["payload"]["connections"].append(original["payload"]["connections"][0])
        original["mac"] = _sign(original["payload"])
        with self.assertRaises(VaultUnavailable):
            verify_audit_checkpoint(json.dumps(original).encode())
        original = json.loads(artifact)
        original["payload"]["connections"][0]["id"] = str(uuid.uuid4())
        original["mac"] = _sign(original["payload"])
        with self.assertRaises(VaultUnavailable):
            verify_audit_checkpoint(json.dumps(original).encode())

    def test_missing_wrong_reused_key_and_disabled_export_fail_closed(self):
        artifact = build_audit_checkpoint()
        with override_settings(CLOUD_PROVIDER_CHECKPOINT_KEY=Fernet.generate_key().decode()):
            with self.assertRaises(VaultUnavailable):
                verify_audit_checkpoint(artifact)
        with override_settings(CLOUD_PROVIDER_CHECKPOINT_KEY=AUDIT):
            with self.assertRaises(VaultUnavailable):
                build_audit_checkpoint()
        with override_settings(CLOUD_PROVIDER_CHECKPOINT_KEY=""):
            with self.assertRaises(VaultUnavailable):
                build_audit_checkpoint()
        with override_settings(CLOUD_PROVIDER_AUDIT_CHECKPOINT_ENABLED=False):
            with self.assertRaises(VaultUnavailable):
                build_audit_checkpoint()
            # Verifying a previously approved external artifact remains possible.
            self.assertTrue(verify_audit_checkpoint(artifact)["integrity_verified"])

    def test_unsequenced_or_corrupted_source_cannot_be_exported(self):
        unsealed = IntegrationConnection.objects.create(
            adapter_key="resend", label="Never audited", environment="test",
            public_settings={"sending_domain": "example.invalid"},
        )
        with self.assertRaises(VaultUnavailable):
            build_audit_checkpoint()
        unsealed.delete()
        IntegrationConnectionEvent.objects.filter(connection=self.row).update(event_mac="0" * 64)
        with self.assertRaises(VaultUnavailable):
            build_audit_checkpoint()

    def test_malformed_oversized_and_noncanonical_envelopes_fail(self):
        artifact = build_audit_checkpoint()
        for doc in (b"", b"not-json", artifact + b" " * MAX_CHECKPOINT_BYTES):
            with self.assertRaises(VaultUnavailable):
                verify_audit_checkpoint(doc)
        envelope = json.loads(artifact)
        envelope["payload"]["connections"][0]["sequence"] = True
        envelope["mac"] = _sign(envelope["payload"])
        with self.assertRaises(VaultUnavailable):
            verify_audit_checkpoint(json.dumps(envelope).encode())

    def test_explicit_export_uses_new_private_file_and_never_overwrites(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "checkpoint.json")
            with self.assertRaises(CommandError):
                call_command("provider_audit_checkpoint", "--output", path, stdout=io.StringIO())
            self.assertFalse(os.path.exists(path))
            call_command(
                "provider_audit_checkpoint", "--output", path,
                "--confirm=EXPORT-PROVIDER-AUDIT-CHECKPOINT", stdout=io.StringIO(),
            )
            self.assertEqual(stat.S_IMODE(os.stat(path).st_mode), 0o600)
            call_command("provider_audit_checkpoint", "--verify", path, stdout=io.StringIO())
            with self.assertRaises(CommandError):
                call_command(
                    "provider_audit_checkpoint", "--output", path,
                    "--confirm=EXPORT-PROVIDER-AUDIT-CHECKPOINT", stdout=io.StringIO(),
                )
