"""Isolated Batch D cryptographic key-boundary and no-network checks.

No KMS, S3, external supplier or Production database access.
"""
from cryptography.fernet import Fernet
from django.test import SimpleTestCase,override_settings

from providers.connection_audit import audit_key
from providers.connection_stepup import cipher as stepup_cipher
from providers.connection_vault import VaultUnavailable,keyring
from providers.isolated_recovery import backup_cipher
from providers.audit_checkpoint import _key as checkpoint_key

VAULT=Fernet.generate_key().decode()
STEPUP=Fernet.generate_key().decode()
AUDIT=Fernet.generate_key().decode()
RECOVERY=Fernet.generate_key().decode()
CHECKPOINT=Fernet.generate_key().decode()

@override_settings(
    CLOUD_PROVIDER_VAULT_KEY=VAULT,CLOUD_PROVIDER_VAULT_KEY_ID="review",
    CLOUD_PROVIDER_STEPUP_KEY=STEPUP,CLOUD_PROVIDER_AUDIT_KEY=AUDIT,
    CLOUD_PROVIDER_RECOVERY_KEY=RECOVERY,CLOUD_PROVIDER_CHECKPOINT_KEY=CHECKPOINT,
    CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON="",
)
class ProviderKeySeparationTests(SimpleTestCase):
    def test_five_independent_key_roles_work_offline(self):
        self.assertEqual(keyring()[0],"review")
        self.assertEqual(len(audit_key()),32)
        self.assertEqual(len(checkpoint_key()),32)
        self.assertIsInstance(stepup_cipher(),Fernet)
        self.assertIsInstance(backup_cipher(),Fernet)

    def test_reusing_audit_key_for_vault_blocks_all_keyring_use(self):
        with override_settings(CLOUD_PROVIDER_AUDIT_KEY=VAULT):
            with self.assertRaises(VaultUnavailable):
                keyring()

    def test_reusing_backup_key_for_totp_blocks_mfa(self):
        with override_settings(CLOUD_PROVIDER_STEPUP_KEY=RECOVERY):
            with self.assertRaises(VaultUnavailable):
                stepup_cipher()

    def test_reusing_checkpoint_key_for_audit_blocks_signatures(self):
        with override_settings(CLOUD_PROVIDER_AUDIT_KEY=CHECKPOINT):
            with self.assertRaises(VaultUnavailable):
                audit_key()

    def test_reusing_checkpoint_key_for_recovery_blocks_snapshot(self):
        with override_settings(CLOUD_PROVIDER_RECOVERY_KEY=CHECKPOINT):
            with self.assertRaises(VaultUnavailable):
                backup_cipher()

    def test_previous_vault_key_must_not_equal_another_role(self):
        import json
        with override_settings(CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON=json.dumps({"old":STEPUP})):
            with self.assertRaises(VaultUnavailable):
                keyring()

    def test_missing_key_still_refuses_all_sensitive_operations(self):
        for key,action in (
            ("CLOUD_PROVIDER_VAULT_KEY",keyring),
            ("CLOUD_PROVIDER_STEPUP_KEY",stepup_cipher),
            ("CLOUD_PROVIDER_AUDIT_KEY",audit_key),
            ("CLOUD_PROVIDER_RECOVERY_KEY",backup_cipher),
            ("CLOUD_PROVIDER_CHECKPOINT_KEY",checkpoint_key),
        ):
            with self.subTest(key=key),override_settings(**{key:""}):
                with self.assertRaises(VaultUnavailable):
                    action()
