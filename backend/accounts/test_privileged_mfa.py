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

    @override_settings(CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED=True)
    def test_operator_recovery_grant_is_one_use_and_revokes_old_access(self):
        from accounts.passkey_enrollment import issue_grant
        from accounts.session_tokens import ConsoleRefreshToken
        from accounts.privileged_mfa import ASSURANCE

        old = PrivilegedPasskey.objects.create(user=self.admin, credential_id="aw", public_key=b"old-key")
        prior = ConsoleRefreshToken.for_user(self.admin)
        prior[ASSURANCE] = old.pk
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + str(prior.access_token))
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)

        path = "/api/auth/passkeys/enroll/"
        code = issue_grant(self.admin, "security-review-fixture", recovery=True)
        submit = {"code":code, "password":self.password}
        self.assertEqual(self.client.post(path, {**submit, "password":"incorrect"}, format="json").status_code, 403)
        started = self.client.post(path, submit, format="json")
        self.assertEqual(started.status_code, 200, started.data)
        self.assertEqual(started.data["public_key"]["authenticatorSelection"]["userVerification"], "required")
        self.assertIsNone(PrivilegedPasskey.objects.get(pk=old.pk).revoked_at)

        evidence = {**submit, "credential":{"id":"fixture"}}
        with patch("accounts.passkey_enrollment.verify_registration_response",
                   return_value=SimpleNamespace(credential_id=b"replacement", credential_public_key=b"key", sign_count=0)) as verifier:
            response = self.client.post(path, evidence, format="json")
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(self.client.post(path, evidence, format="json").status_code, 403)
            verifier.assert_called_once()
            self.assertEqual(verifier.call_args.kwargs["expected_origin"], "https://console.cloud.octalve.com")
        self.assertIsNotNone(PrivilegedPasskey.objects.get(pk=old.pk).revoked_at)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
        self.assertEqual(PrivilegedPasskey.objects.filter(user=self.admin,revoked_at__isnull=True).count(), 1)


    def test_basic_and_existing_django_session_cannot_bypass_enforcement(self):
        from base64 import b64encode
        from rest_framework.test import APIClient

        basic = b64encode(f"{self.admin.email}:{self.password}".encode()).decode()
        self.client.credentials(HTTP_AUTHORIZATION="Basic " + basic)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 403)
        session = APIClient()
        session.force_login(self.admin)
        self.assertEqual(session.get("/api/auth/me/").status_code, 403)
        self.assertEqual(session.get("/api-auth/login/").status_code, 403)
        user = get_user_model().objects.create_user(
            email="basic-client@example.invalid", username="basic-client", password=self.password,
        )
        self.client.credentials(HTTP_AUTHORIZATION="Basic " + b64encode(
            f"{user.email}:{self.password}".encode()).decode())
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)

    @override_settings(CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED=False,
                       CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED=False)
    def test_explicit_qualification_denies_when_disabled(self):
        response = self.client.post(self.login, {**self.credentials, "passkey_qualification": True}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("access", response.data)
        self.assertEqual(self.client.post(self.login, self.credentials, format="json").status_code, 200)

    @override_settings(CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED=False,
                       CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED=True)
    def test_enrollment_only_real_signature_origin_replay_and_revocation(self):
        import hashlib
        import json
        import cbor2
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import ec
        from django.utils import timezone
        from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
        from audit.models import AuditLog

        # Synthetic software key signs actual WebAuthn assertion bytes. No
        # verifier is mocked; this is cryptographic regression, not browser evidence.
        private = ec.generate_private_key(ec.SECP256R1())
        point = private.public_key().public_numbers()
        cose = cbor2.dumps({1: 2, 3: -7, -1: 1,
                            -2: point.x.to_bytes(32, "big"), -3: point.y.to_bytes(32, "big")})
        key = PrivilegedPasskey.objects.create(user=self.admin,
            credential_id=bytes_to_base64url(b"auth01-software-fixture"), public_key=cose)
        qualification = {**self.credentials, "passkey_qualification": True}
        self.assertEqual(self.client.post(self.login, self.credentials, format="json").status_code, 200)
        def assertion(origin, count, flags=5):
            started = self.client.post(self.login, qualification, format="json")
            self.assertEqual(started.status_code, 428, started.data)
            self.assertNotIn("access", started.data)
            challenge = started.data["public_key"]["challenge"]
            client_data = json.dumps({"type": "webauthn.get", "challenge": challenge,
                                      "origin": origin, "crossOrigin": False}).encode()
            auth_data = hashlib.sha256(b"console.cloud.octalve.com").digest() + bytes([flags]) + count.to_bytes(4, "big")
            signature = private.sign(auth_data + hashlib.sha256(client_data).digest(), ec.ECDSA(hashes.SHA256()))
            return {**qualification, "passkey_challenge": started.data["challenge_id"],
                    "passkey_assertion": {"id": key.credential_id, "rawId": key.credential_id,
                        "type": "public-key", "response": {
                            "clientDataJSON": bytes_to_base64url(client_data),
                            "authenticatorData": bytes_to_base64url(auth_data),
                            "signature": bytes_to_base64url(signature), "userHandle": None}}}

        wrong = assertion("https://wrong.example.invalid", 1)
        self.assertEqual(self.client.post(self.login, wrong, format="json").status_code, 403)
        self.assertIsNotNone(PrivilegedLoginChallenge.objects.get(pk=wrong["passkey_challenge"]).used_at)
        valid = assertion("https://console.cloud.octalve.com", 1)
        reply = self.client.post(self.login, valid, format="json")
        self.assertEqual(reply.status_code, 200, reply.data)
        self.assertIs(reply.data["passkey_verified"], True)
        self.assertEqual(self.client.post(self.login, valid, format="json").status_code, 403)
        self.assertEqual(AuditLog.objects.filter(actor=self.admin, action="login",
                         entity_name="Privileged passkey sign-in").count(), 1)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + reply.data["access"])
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)
        key.revoked_at = timezone.now()
        key.save(update_fields=["revoked_at"])
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
        self.assertEqual(self.client.post("/api/auth/jwt/refresh/", {"refresh": reply.data["refresh"]}, format="json").status_code, 401)

    @override_settings(CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED=False,
                       CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED=True)
    def test_recovery_invalidates_password_session_and_tracked_refresh_without_enforcement(self):
        from rest_framework.test import APIClient
        from accounts.passkey_enrollment import issue_grant

        session = APIClient()
        session.force_login(self.admin)
        self.assertEqual(session.get("/api/auth/me/").status_code, 200)
        old = PrivilegedPasskey.objects.create(user=self.admin, credential_id="aw", public_key=b"old")
        login = self.client.post(self.login, self.credentials, format="json")
        self.assertEqual(login.status_code, 200, login.data)
        old_hash = self.admin.password
        code = issue_grant(self.admin, "approved-fixture", recovery=True)
        path = "/api/auth/passkeys/enroll/"
        submit = {"code": code, "password": self.password}
        started = self.client.post(path, submit, format="json")
        self.assertEqual(started.status_code, 200, started.data)
        self.assertIn(old.credential_id, [item["id"] for item in started.data["public_key"]["excludeCredentials"]])
        with patch("accounts.passkey_enrollment.verify_registration_response",
                   return_value=SimpleNamespace(credential_id=b"replacement", credential_public_key=b"key", sign_count=0)):
            result = self.client.post(path, {**submit, "credential": {"id": "fixture"}}, format="json")
        self.assertEqual(result.status_code, 201, result.data)
        self.admin.refresh_from_db()
        self.assertNotEqual(self.admin.password, old_hash)
        self.assertTrue(self.admin.check_password(self.password))
        self.assertEqual(session.get("/api/auth/me/").status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + login.data["access"])
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)
        self.assertEqual(self.client.post("/api/auth/jwt/refresh/", {"refresh": login.data["refresh"]}, format="json").status_code, 401)
        self.assertEqual(PrivilegedPasskey.objects.filter(user=self.admin, revoked_at__isnull=True).count(), 1)

    @override_settings(CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED=False,
                       CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED=True)
    def test_ordinary_account_cannot_request_privileged_qualification(self):
        user = get_user_model().objects.create_user(email="normal@example.invalid", username="normal", password=self.password)
        credentials = {"email": user.email, "password": self.password}
        response = self.client.post(self.login, {**credentials, "passkey_qualification": True}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.client.post(self.login, credentials, format="json").status_code, 200)
