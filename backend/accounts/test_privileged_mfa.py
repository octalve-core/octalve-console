from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import PrivilegedLoginChallenge, PrivilegedPasskey


@override_settings(CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED=True)
class PrivilegedPasskeyTests(APITestCase):
    login = "/api/auth/jwt/create/"
    password = "Test-only passkey account password"

    def setUp(self):
        self.admin = get_user_model().objects.create_superuser(
            email="passkey-admin@example.invalid", username="passkey-admin", password=self.password,
        )
        self.credentials = {"email": self.admin.email, "password": self.password}

    def test_password_and_legacy_tokens_cannot_open_privileged_session(self):
        response = self.client.post(self.login, self.credentials, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("access", response.data)
        legacy = RefreshToken.for_user(self.admin)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + str(legacy.access_token))
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
        self.assertEqual(self.client.post("/api/auth/jwt/refresh/", {"refresh": str(legacy)}, format="json").status_code, 401)
        self.assertEqual(self.client.get("/admin/").status_code, 403)

    def test_challenge_is_one_use_and_revoked_key_invalidates_token(self):
        key = PrivilegedPasskey.objects.create(user=self.admin, credential_id="aw", public_key=b"test-public-key")
        started = self.client.post(self.login, self.credentials, format="json")
        self.assertEqual(started.status_code, 428, started.data)
        self.assertEqual(started.data["public_key"]["userVerification"], "required")
        self.assertNotIn("access", started.data)
        payload = {**self.credentials, "passkey_challenge": started.data["challenge_id"],
                   "passkey_assertion": {"id": key.credential_id}}
        with patch("accounts.privileged_mfa.verify_authentication_response",
                   return_value=SimpleNamespace(credential_id=b"k", new_sign_count=1)) as verifier:
            authenticated = self.client.post(self.login, payload, format="json")
            self.assertEqual(authenticated.status_code, 200, authenticated.data)
            self.assertEqual(self.client.post(self.login, payload, format="json").status_code, 403)
            verifier.assert_called_once()
            self.assertTrue(verifier.call_args.kwargs["require_user_verification"])
            self.assertEqual(verifier.call_args.kwargs["expected_origin"], "https://console.cloud.octalve.com")
        self.assertIsNotNone(PrivilegedLoginChallenge.objects.get(pk=started.data["challenge_id"]).used_at)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + authenticated.data["access"])
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)
        from django.utils import timezone
        key.revoked_at = timezone.now()
        key.save(update_fields=["revoked_at"])
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_unprivileged_client_login_remains_available(self):
        user = get_user_model().objects.create_user(
            email="passkey-client@example.invalid", username="passkey-client", password=self.password,
        )
        response = self.client.post(self.login, {"email": user.email, "password": self.password}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
