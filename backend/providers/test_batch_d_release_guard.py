"""Fail-closed independent release gate for provider credential mutation.

All tests are purely local; never talk to suppliers or accept real secrets.
"""
from types import SimpleNamespace
from django.test import SimpleTestCase,override_settings
from providers.connection_views import require_write_authority
from providers.connection_vault import VaultUnavailable

class ProviderReleaseInterlockTests(SimpleTestCase):
    def setUp(self):
        self.dummy=SimpleNamespace(user=None,data={})

    @override_settings(CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=True,
                       CLOUD_PROVIDER_VAULT_WRITE_RELEASE_APPROVED=False)
    def test_write_flag_alone_cannot_enable_provider_credential_mutations(self):
        with self.assertRaises(VaultUnavailable):
            require_write_authority(self.dummy)

    @override_settings(CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=False,
                       CLOUD_PROVIDER_VAULT_WRITE_RELEASE_APPROVED=True)
    def test_approval_flag_alone_cannot_enable_provider_credential_mutations(self):
        with self.assertRaises(VaultUnavailable):
            require_write_authority(self.dummy)

    @override_settings(CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=False,
                       CLOUD_PROVIDER_VAULT_WRITE_RELEASE_APPROVED=False)
    def test_no_flags_is_default_denied(self):
        with self.assertRaises(VaultUnavailable):
            require_write_authority(self.dummy)
