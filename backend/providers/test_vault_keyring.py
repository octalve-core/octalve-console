"""Offline rewrap and recovery-failure simulation. No real provider endpoints."""
import json
from unittest.mock import patch
from cryptography.fernet import Fernet
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase,override_settings
from providers.connection_models import IntegrationConnection,IntegrationCredentialVersion
from providers.connection_vault import seal,unseal_version,rewrap_versions,VaultUnavailable

OLD=Fernet.generate_key().decode()
NEW=Fernet.generate_key().decode()
VALUE={"api_token":"CI-FAKE-NONFUNCTIONAL-KEY-123456"}
OLDER={"login_key":"CI-NONFUNCTIONAL-OLDER-KEY-1"}

@override_settings(CLOUD_PROVIDER_VAULT_KEY=OLD,CLOUD_PROVIDER_VAULT_KEY_ID="old",
                   CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON="",
                   CLOUD_PROVIDER_STEPUP_KEY=Fernet.generate_key().decode())
class VaultKeyringTests(TestCase):
    def setUp(self):
        self.connection=IntegrationConnection.objects.create(
            adapter_key="cpanel-whm",label="Isolated Test",environment="test",
            public_settings={"server_url":"https://example.invalid:2087","username":"reseller"})
        self.first=IntegrationCredentialVersion.objects.create(
            connection=self.connection,version=1,key_id="old",
            ciphertext=seal(self.connection.adapter_key,self.connection.pk,1,OLDER))
        self.second=IntegrationCredentialVersion.objects.create(
            connection=self.connection,version=2,key_id="old",
            ciphertext=seal(self.connection.adapter_key,self.connection.pk,2,VALUE))
        self.key_config={"CLOUD_PROVIDER_VAULT_KEY":NEW,
                         "CLOUD_PROVIDER_VAULT_KEY_ID":"new",
                         "CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON":json.dumps({"old":OLD})}

    def test_dry_run_then_atomic_rewrap_and_retire_old_key(self):
        old=self.second.ciphertext
        with override_settings(**self.key_config):
            self.assertEqual(rewrap_versions(),{"examined":2,"rewrapped":2,"applied":False})
            self.second.refresh_from_db()
            self.assertEqual(self.second.ciphertext,old)
            with override_settings(CLOUD_PROVIDER_VAULT_REWRAP_ENABLED=True):
                result=rewrap_versions(apply=True)
            self.assertEqual(result["rewrapped"],2)
        for row,secret in [(self.first,OLDER),(self.second,VALUE)]:
            row.refresh_from_db()
            self.assertEqual(row.key_id,"new")
            self.assertNotIn(list(secret.values())[0],row.ciphertext)
            with override_settings(CLOUD_PROVIDER_VAULT_KEY=NEW,CLOUD_PROVIDER_VAULT_KEY_ID="new",
                                   CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON=""):
                self.assertEqual(unseal_version(row),secret)

    def test_missing_old_key_fails_before_mutation(self):
        original=self.first.ciphertext
        with override_settings(CLOUD_PROVIDER_VAULT_KEY=NEW,CLOUD_PROVIDER_VAULT_KEY_ID="new",
                               CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON="",
                               CLOUD_PROVIDER_VAULT_REWRAP_ENABLED=True):
            with self.assertRaises(VaultUnavailable):
                rewrap_versions(apply=True)
        self.first.refresh_from_db()
        self.assertEqual(self.first.ciphertext,original)
        self.assertEqual(self.first.key_id,"old")

    def test_corruption_fails_all_or_nothing(self):
        self.second.ciphertext="bad-ciphertext"
        self.second.save(update_fields=["ciphertext"])
        original=self.first.ciphertext
        with override_settings(**self.key_config,CLOUD_PROVIDER_VAULT_REWRAP_ENABLED=True):
            with self.assertRaises(VaultUnavailable):
                rewrap_versions(apply=True)
        self.first.refresh_from_db()
        self.assertEqual(self.first.ciphertext,original)
        self.assertEqual(self.first.key_id,"old")

    def test_cross_connection_ciphertext_swap_rejected(self):
        other=IntegrationConnection.objects.create(
            adapter_key="cpanel-whm",label="Different Customer",environment="test",
            public_settings={})
        other_record=IntegrationCredentialVersion.objects.create(
            connection=other,version=1,key_id="old",ciphertext=self.first.ciphertext)
        with self.assertRaises(VaultUnavailable):
            unseal_version(other_record)

    def test_interrupted_rewrap_rolls_back_all_ciphertext(self):
        original=self.first.ciphertext
        original_save=IntegrationCredentialVersion.save
        calls=[0]
        def interrupt(instance,*args,**kwargs):
            calls[0]+=1
            if calls[0]==2:
                raise RuntimeError("Simulated partial DB failure")
            return original_save(instance,*args,**kwargs)
        with override_settings(**self.key_config,CLOUD_PROVIDER_VAULT_REWRAP_ENABLED=True):
            with patch.object(IntegrationCredentialVersion,"save",interrupt):
                with self.assertRaises(RuntimeError):
                    rewrap_versions(apply=True)
        self.first.refresh_from_db()
        self.assertEqual(self.first.key_id,"old")
        self.assertEqual(self.first.ciphertext,original)

    def test_command_requires_explicit_guarded_confirmation(self):
        with override_settings(**self.key_config):
            with self.assertRaises(CommandError):
                call_command("rewrap_provider_vault","--apply")
            with self.assertRaises(CommandError):
                call_command("rewrap_provider_vault","--apply","--confirm=REWRAP-PROVIDER-VAULT")
            call_command("rewrap_provider_vault")
        self.assertEqual(IntegrationCredentialVersion.objects.filter(key_id="old").count(),2)

    def test_invalid_duplicate_key_id_and_wrong_custody_rejected(self):
        for extra in [
            {"CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON":json.dumps({"new":OLD})},
            {"CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON":"not-json"},
            {"CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON":json.dumps({"old":NEW})},
        ]:
            with override_settings(**self.key_config,**extra):
                with self.assertRaises(VaultUnavailable):
                    rewrap_versions()
