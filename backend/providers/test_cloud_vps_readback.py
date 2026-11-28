import json
from unittest.mock import MagicMock
from django.test import SimpleTestCase
from providers.connection_specs import READBACK_ADAPTERS, public_catalog
from providers.connection_verification import ProviderReadbackFailed
from providers.cloud_vps_readback import verify_cloud_access


class CloudVpsReadbackTests(SimpleTestCase):
    def fixture(self, body, status=200, headers=None, raw=None):
        session = MagicMock()
        response = session.get.return_value.__enter__.return_value
        response.status_code = status
        response.headers = headers or {}
        response.iter_content.return_value = [
            raw if raw is not None else json.dumps(body).encode()
        ]
        return session

    def test_fixed_origins_and_redacted_readonly_proof(self):
        cases = (
            ("digitalocean", "https://api.digitalocean.com/v2/account",
             {"account": {"uuid": "account-1", "email": "private@example.invalid"}}),
            ("hetzner", "https://api.hetzner.cloud/v1/servers?per_page=1",
             {"servers": [], "meta": {"pagination": {}}}),
            ("vultr", "https://api.vultr.com/v2/account",
             {"account": {"email": "private@example.invalid", "balance": 250}}),
        )
        for adapter, url, body in cases:
            with self.subTest(adapter=adapter):
                session = self.fixture(body)
                result = verify_cloud_access(adapter, "fixture-token-1234",
                                             session_factory=lambda: session)
                self.assertEqual(result, {"authenticated": True, "read_only": True,
                                          "provisioning_enabled": False})
                session.get.assert_called_once_with(
                    url, headers={"Authorization": "Bearer fixture-token-1234",
                                  "Accept": "application/json"},
                    timeout=(3, 8), verify=True, allow_redirects=False, stream=True)
                self.assertFalse(session.trust_env)
                session.close.assert_called_once()
                self.assertIn(adapter, READBACK_ADAPTERS)
                item = next(row for row in public_catalog() if row["key"] == adapter)
                self.assertTrue(item["supports_verification"])
                self.assertFalse(item["enabled_for_execution"])

    def test_invalid_or_unbounded_response_is_refused(self):
        for options in (
            {"body": {}, "status": 401},
            {"body": {}, "status": 302},
            {"body": {"account": {}}},
            {"body": {}, "headers": {"Content-Length": "65537"}},
            {"body": {}, "raw": b"x" * 65537},
            {"body": {}, "raw": b"not-json"},
        ):
            with self.subTest(options=list(options)):
                session = self.fixture(**options)
                with self.assertRaises(ProviderReadbackFailed):
                    verify_cloud_access("digitalocean", "fixture-token-1234",
                                        session_factory=lambda: session)
                session.close.assert_called_once()

    def test_unknown_origin_and_header_injection_refused_before_network(self):
        factory = MagicMock()
        for adapter, token in (("unknown", "fixture-token-1234"),
                               ("vultr", "fixture-token\r\n1234")):
            with self.assertRaises(ProviderReadbackFailed):
                verify_cloud_access(adapter, token, session_factory=factory)
        factory.assert_not_called()
