"""P0 integration metadata checks: no OPanel bypass, no vendor network calls."""
from unittest.mock import patch
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError
from providers.connection_specs import SCHEMAS, validate_public_settings, validate_secrets, public_catalog
from opanel_bridge.policy import enabled

class FirstPartyAndEmailRegistryTests(SimpleTestCase):
    def test_opanel_and_brevo_specs_are_discoverable_but_inert(self):
        catalog={row["key"]:row for row in public_catalog()}
        for key in ("opanel","brevo","directadmin","cpanel-whm"):
            self.assertIn(key,catalog)
            self.assertFalse(catalog[key]["enabled_for_execution"])
        self.assertEqual(SCHEMAS["opanel"]["secrets"],("client_secret",))
        self.assertEqual(SCHEMAS["brevo"]["secrets"],("api_key",))
        self.assertFalse(enabled(), "OPanel Console SSO must not start from a catalogue card")

    def test_opanel_origin_only_preapproved_tls_host(self):
        with patch.dict("os.environ",{"CLOUD_CONNECTION_ALLOWED_HOSTS":"opanel.example.invalid"}):
            valid=validate_public_settings("opanel",{
                "panel_url":"https://opanel.example.invalid",
                "client_id":"octalve-opanel"})
            self.assertEqual(valid["panel_url"],"https://opanel.example.invalid:443")
            for url in ("http://opanel.example.invalid",
                        "https://127.0.0.1","https://169.254.169.254",
                        "https://opanel.example.invalid:8080",
                        "https://opanel.example.invalid/evil",
                        "https://user:pass@opanel.example.invalid",
                        "https://metadata.google.internal"):
                with self.subTest(url=url),self.assertRaises(ValidationError):
                    validate_public_settings("opanel",{
                        "panel_url":url,"client_id":"octalve-opanel"})

    def test_opanel_client_secret_length_cannot_be_short(self):
        with self.assertRaises(ValidationError):
            validate_secrets("opanel",{"client_secret":"too-short-secret"})
        value=validate_secrets("opanel",{"client_secret":"A"*48})
        self.assertEqual(len(value["client_secret"]),48)
        with self.assertRaises(ValidationError):
            validate_secrets("opanel",{"client_secret":"A"*48,"password":"extra"})

    def test_brevo_domain_and_api_key_require_exact_fields(self):
        valid=validate_public_settings("brevo",{"sending_domain":"mail.example.invalid"})
        self.assertEqual(valid["sending_domain"],"mail.example.invalid")
        with self.assertRaises(ValidationError):
            validate_public_settings("brevo",{"sending_domain":"http://127.0.0.1"})
        with self.assertRaises(ValidationError):
            validate_secrets("brevo",{"api_key":"short"})
        self.assertEqual(validate_secrets("brevo",{"api_key":"TEST_ONLY_NOT_A_REAL_TOKEN_12345"})["api_key"],
                         "TEST_ONLY_NOT_A_REAL_TOKEN_12345")
