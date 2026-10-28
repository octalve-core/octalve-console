"""Future deployment must not turn on provider-secret entry by one env toggle."""
from types import SimpleNamespace
from unittest.mock import patch
from django.test import SimpleTestCase, override_settings
from providers.connection_views import require_write_authority
from providers.connection_vault import VaultUnavailable


class ProviderCredentialReleaseHoldTests(SimpleTestCase):
    def call_write(self):
        require_write_authority(SimpleNamespace(user=None,data={}))

    @override_settings(DEBUG=True, CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=True)
    def test_legacy_write_flag_alone_can_never_open_vault(self):
        with self.assertRaises(VaultUnavailable):
            self.call_write()

    @override_settings(DEBUG=False,
                       CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=True,
                       CLOUD_PROVIDER_SYNTHETIC_REVIEW_WRITES_ENABLED=True)
    def test_even_explicit_synthetic_review_flag_cannot_open_production(self):
        with self.assertRaises(VaultUnavailable):
            self.call_write()

    @override_settings(DEBUG=True,
                       CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=True,
                       CLOUD_PROVIDER_SYNTHETIC_REVIEW_WRITES_ENABLED=True)
    def test_serverless_runtime_always_refuses(self):
        for name,variables in (
            ("prod",{"VERCEL_ENV":"production"}),
            ("preview",{"VERCEL_ENV":"preview"}),
            ("dev",{"VERCEL_ENV":"development"}),
            ("vercel_marker",{"VERCEL":"1"}),
        ):
            with self.subTest(name=name),patch.dict("os.environ",variables):
                with self.assertRaises(VaultUnavailable):
                    self.call_write()

    @override_settings(DEBUG=True,
                       CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=False,
                       CLOUD_PROVIDER_SYNTHETIC_REVIEW_WRITES_ENABLED=True)
    def test_review_flag_without_write_flag_is_not_enough(self):
        with self.assertRaises(VaultUnavailable):
            self.call_write()
