"""Bounded encrypted provider snapshot verification in a separate SQLite memory database."""
import json
import uuid
from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.test import TestCase,override_settings
from providers.connection_models import IntegrationConnection,IntegrationCredentialVersion,IntegrationConnectionEvent
from providers.connection_audit import append_event
from providers.connection_vault import seal,VaultUnavailable
from providers.isolated_recovery import build_isolated_snapshot,verify_isolated_snapshot

VAULT_KEY=Fernet.generate_key().decode()
STEP_KEY=Fernet.generate_key().decode()
AUDIT_KEY=Fernet.generate_key().decode()
BACKUP_KEY=Fernet.generate_key().decode()
SYNTHETIC="CI-ONLY-NOT-A-USABLE-SUPPLIER-TOKEN"
@override_settings(CLOUD_PROVIDER_VAULT_KEY=VAULT_KEY,CLOUD_PROVIDER_VAULT_KEY_ID="v1",
   CLOUD_PROVIDER_STEPUP_KEY=STEP_KEY,CLOUD_PROVIDER_AUDIT_KEY=AUDIT_KEY,
   CLOUD_PROVIDER_RECOVERY_KEY=BACKUP_KEY,CLOUD_PROVIDER_SNAPSHOT_REVIEW_ENABLED=True,
   CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON="")
class IsolatedRecoveryTests(TestCase):
    def setUp(self):
        self.actor=get_user_model().objects.create_superuser(
             email="isolated-restore@example.invalid",username="isolatedrecovery",
             password="CI-only-recovery-passphrase-12345")
        with transaction.atomic():
            self.row=IntegrationConnection.objects.create(
                adapter_key="resend",label="Synthetic recovery subject",
                environment="test",public_settings={"sending_domain":"example.invalid"})
            self.version=IntegrationCredentialVersion.objects.create(
                connection=self.row,version=1,key_id="v1",
                ciphertext=seal("resend",self.row.pk,1,{"api_key":SYNTHETIC}))
            append_event(self.row,self.actor,"draft_created",1)

    def test_synthetic_snapshot_restores_and_validates_separately(self):
        before=self.version.ciphertext
        blob=build_isolated_snapshot()
        self.assertIsInstance(blob,bytes)
        self.assertNotIn(SYNTHETIC.encode(),blob)
        report=verify_isolated_snapshot(blob)
        self.assertEqual(report["connections"],1)
        self.assertEqual(report["versions"],1)
        self.assertEqual(report["events"],1)
        self.assertTrue(report["isolated"])
        self.version.refresh_from_db()
        self.assertEqual(self.version.ciphertext,before)
        self.assertEqual(IntegrationConnectionEvent.objects.count(),1)

    def test_wrong_recovery_key_and_corrupt_envelope_block_restore(self):
        blob=build_isolated_snapshot()
        with override_settings(CLOUD_PROVIDER_RECOVERY_KEY=Fernet.generate_key().decode()):
            with self.assertRaises(VaultUnavailable): verify_isolated_snapshot(blob)
        altered=blob[:95]+(b"X" if blob[95:96]!=b"X" else b"Y")+blob[96:]
        with self.assertRaises(VaultUnavailable): verify_isolated_snapshot(altered)

    def test_stolen_backup_key_cannot_swap_provider_identity_or_ciphertext(self):
        crypt=Fernet(BACKUP_KEY.encode())
        original=json.loads(crypt.decrypt(build_isolated_snapshot()))
        forged=json.loads(json.dumps(original))
        forged["connections"][0]["id"]=str(uuid.uuid4())
        with self.assertRaises(VaultUnavailable):
            verify_isolated_snapshot(crypt.encrypt(json.dumps(forged).encode()))
        forged=json.loads(json.dumps(original))
        forged["connections"][0]["versions"][0]["cipher"]="invalid"
        with self.assertRaises(VaultUnavailable):
            verify_isolated_snapshot(crypt.encrypt(json.dumps(forged).encode()))

    def test_missing_event_or_audit_key_blocks_restore(self):
        crypt=Fernet(BACKUP_KEY.encode())
        body=json.loads(crypt.decrypt(build_isolated_snapshot()))
        body["connections"][0]["events"]=[]
        with self.assertRaises(VaultUnavailable):
            verify_isolated_snapshot(crypt.encrypt(json.dumps(body).encode()))
        with override_settings(CLOUD_PROVIDER_AUDIT_KEY=""):
            with self.assertRaises(VaultUnavailable):
                verify_isolated_snapshot(build_isolated_snapshot())

    def test_missing_historical_version_or_forged_lifecycle_state_fails(self):
        crypt=Fernet(BACKUP_KEY.encode())
        original=json.loads(crypt.decrypt(build_isolated_snapshot()))
        forged=json.loads(json.dumps(original))
        forged["connections"][0]["versions"]=[]
        with self.assertRaises(VaultUnavailable):
            verify_isolated_snapshot(crypt.encrypt(json.dumps(forged).encode()))
        forged=json.loads(json.dumps(original))
        forged["connections"][0]["state"]="revoked"
        with self.assertRaises(VaultUnavailable):
            verify_isolated_snapshot(crypt.encrypt(json.dumps(forged).encode()))
        forged=json.loads(json.dumps(original))
        forged["connections"][0]["current"]=2
        with self.assertRaises(VaultUnavailable):
            verify_isolated_snapshot(crypt.encrypt(json.dumps(forged).encode()))

    def test_source_with_incomplete_credential_history_cannot_be_exported(self):
        # Simulate an incomplete database snapshot using a second recorded version
        # without the corresponding signed credential_rotated event.
        self.row.current_version=2
        self.row.save(update_fields=["current_version"])
        with self.assertRaises(VaultUnavailable):
            build_isolated_snapshot()

    def test_complete_rotation_and_revocation_history_passes(self):
        # Version 1 is superseded, version 2 becomes active; both signed events
        # must be present to accept the replacement snapshot.
        self.version.revoked_at=timezone.now()
        self.version.save(update_fields=["revoked_at"])
        IntegrationCredentialVersion.objects.create(
            connection=self.row,version=2,key_id="v1",
            ciphertext=seal("resend",self.row.pk,2,{"api_key":SYNTHETIC+"-rotated"}))
        self.row.current_version=2
        self.row.save(update_fields=["current_version"])
        with transaction.atomic():
            append_event(self.row,self.actor,"credential_rotated",2)
        report=verify_isolated_snapshot(build_isolated_snapshot())
        self.assertEqual((report["versions"],report["events"]),(2,2))
        IntegrationCredentialVersion.objects.filter(connection=self.row,version=2).update(revoked_at=timezone.now())
        self.row.state="revoked"
        self.row.save(update_fields=["state"])
        with transaction.atomic():
            append_event(self.row,self.actor,"credential_revoked",2)
        report=verify_isolated_snapshot(build_isolated_snapshot())
        self.assertEqual((report["versions"],report["events"]),(2,3))

    def test_export_is_default_off_and_requires_independent_key(self):
        with override_settings(CLOUD_PROVIDER_SNAPSHOT_REVIEW_ENABLED=False):
            with self.assertRaises(VaultUnavailable):
                build_isolated_snapshot()
        with override_settings(CLOUD_PROVIDER_RECOVERY_KEY=VAULT_KEY):
            with self.assertRaises(VaultUnavailable):
                build_isolated_snapshot()
