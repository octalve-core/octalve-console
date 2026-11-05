"""INT-02: versioned TOTP ciphertext and independent offline recovery tests."""
import json
from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.test import TestCase,override_settings
from providers.connection_models import ProviderVaultAuthenticator
from providers.connection_stepup import (
    encrypt_stepup_secret,protected_secret,rewrap_stepup_authenticators,
    stepup_keyring,
)
from providers.connection_vault import VaultUnavailable

OLD=Fernet.generate_key().decode()
NEW=Fernet.generate_key().decode()
VAULT=Fernet.generate_key().decode()
AUDIT=Fernet.generate_key().decode()
SECRET="JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"


@override_settings(
    CLOUD_PROVIDER_STEPUP_KEY=OLD,
    CLOUD_PROVIDER_STEPUP_KEY_ID="v1",
    CLOUD_PROVIDER_STEPUP_PREVIOUS_KEYS_JSON="",
    CLOUD_PROVIDER_STEPUP_REWRAP_ENABLED=False,
    CLOUD_PROVIDER_VAULT_KEY=VAULT,
    CLOUD_PROVIDER_AUDIT_KEY=AUDIT,
)
class StepupKeyRotationTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_superuser(
            email="stepup-keyring@example.invalid",
            username="stepup_keyring",password="Only-CI-Not-Production-200")
        self.row=ProviderVaultAuthenticator.objects.create(
            user=self.user,encrypted_secret=encrypt_stepup_secret(SECRET),
            verified=True,last_counter=100,
        )

    def test_stepup_rotation_recovery_requires_old_key_until_rewrapped(self):
        self.assertTrue(self.row.encrypted_secret.startswith("v1."))
        self.assertEqual(protected_secret(self.row),SECRET)
        with override_settings(CLOUD_PROVIDER_STEPUP_KEY=NEW,CLOUD_PROVIDER_STEPUP_KEY_ID="v2",
            CLOUD_PROVIDER_STEPUP_PREVIOUS_KEYS_JSON=json.dumps({"v1":OLD})):
            self.assertEqual(protected_secret(self.row),SECRET)
            self.assertEqual(rewrap_stepup_authenticators(),{
                "examined":1,"rewrapped":1,"applied":False
            })
            with self.assertRaises(VaultUnavailable):
                rewrap_stepup_authenticators(apply=True)
            self.row.refresh_from_db()
            self.assertTrue(self.row.encrypted_secret.startswith("v1."))
            with override_settings(CLOUD_PROVIDER_STEPUP_REWRAP_ENABLED=True):
                result=rewrap_stepup_authenticators(apply=True)
                self.assertEqual(result["rewrapped"],1)
                self.assertTrue(result["applied"])
            self.row.refresh_from_db()
            self.assertTrue(self.row.encrypted_secret.startswith("v2."))
            self.assertEqual(self.row.last_counter,100)
            with override_settings(CLOUD_PROVIDER_STEPUP_PREVIOUS_KEYS_JSON=""):
                self.assertEqual(protected_secret(self.row),SECRET)

    def test_legacy_unversioned_token_reads_only_as_v1(self):
        self.row.encrypted_secret=Fernet(OLD.encode()).encrypt(SECRET.encode()).decode()
        self.row.save(update_fields=["encrypted_secret"])
        self.assertEqual(protected_secret(self.row),SECRET)
        with override_settings(CLOUD_PROVIDER_STEPUP_KEY=NEW,CLOUD_PROVIDER_STEPUP_KEY_ID="v2",
            CLOUD_PROVIDER_STEPUP_PREVIOUS_KEYS_JSON=json.dumps({"v1":OLD})):
            self.assertEqual(protected_secret(self.row),SECRET)
        with override_settings(CLOUD_PROVIDER_STEPUP_KEY=NEW,CLOUD_PROVIDER_STEPUP_KEY_ID="v2",
            CLOUD_PROVIDER_STEPUP_PREVIOUS_KEYS_JSON=""):
            with self.assertRaises(VaultUnavailable):
                protected_secret(self.row)

    def test_missing_historical_key_and_duplicate_key_fail_closed(self):
        with override_settings(CLOUD_PROVIDER_STEPUP_KEY=NEW,CLOUD_PROVIDER_STEPUP_KEY_ID="v2"):
            with self.assertRaises(VaultUnavailable):
                rewrap_stepup_authenticators()
        with override_settings(CLOUD_PROVIDER_STEPUP_KEY=NEW,CLOUD_PROVIDER_STEPUP_KEY_ID="v2",
            CLOUD_PROVIDER_STEPUP_PREVIOUS_KEYS_JSON=json.dumps({"v1":NEW})):
            with self.assertRaises(VaultUnavailable):
                stepup_keyring()
        with override_settings(CLOUD_PROVIDER_STEPUP_PREVIOUS_KEYS_JSON="not-json"):
            with self.assertRaises(VaultUnavailable):
                stepup_keyring()
        self.row.refresh_from_db()
        self.assertTrue(self.row.encrypted_secret.startswith("v1."))
