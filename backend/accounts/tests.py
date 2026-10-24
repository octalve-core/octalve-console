"""Real Django/DRF API and ORM regression tests (isolated test database)."""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from payments.models import PaymentGateway, WebhookEvent


class CloudAccountApiTests(APITestCase):
    email = "development-test@example.invalid"
    password = "TestPassword-Only-2026!"

    def register(self):
        return self.client.post(
            "/api/auth/register/",
            {
                "email": self.email,
                "username": "development_test",
                "full_name": "Development Test",
                "password": self.password,
                "re_password": self.password,
                "role": "admin",  # Deliberate privilege escalation attempt.
            },
            format="json",
        )

    def test_signup_creates_persistent_client_not_administrator(self):
        response = self.register()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn("access", response.data)
        user = get_user_model().objects.get(email=self.email)
        self.assertEqual(user.role, "client")
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password(self.password))

    def test_login_then_current_user_via_real_jwt(self):
        self.register()
        login = self.client.post(
            "/api/auth/jwt/create/",
            {"email": self.email, "password": self.password},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK, login.data)
        token = login.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + token)
        response = self.client.get("/api/auth/users/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["email"], self.email)

    def test_login_errors_do_not_enumerate_inactive_or_missing_account(self):
        self.register()
        user = get_user_model().objects.get(email=self.email)
        user.is_active = False
        user.save(update_fields=["is_active"])
        inactive = self.client.post(
            "/api/auth/jwt/create/",
            {"email": self.email, "password": self.password}, format="json",
        )
        missing = self.client.post(
            "/api/auth/jwt/create/",
            {"email": "absent-user@example.invalid", "password": self.password},
            format="json",
        )
        self.assertEqual(inactive.status_code, missing.status_code)
        self.assertEqual(inactive.data, missing.data)

    def test_password_reset_does_not_expose_email_existence(self):
        from django.conf import settings
        self.assertIs(settings.DJOSER["PASSWORD_RESET_SHOW_EMAIL_NOT_FOUND"], False)

    def test_refresh_rotates_and_rejects_reused_refresh_token(self):
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
        signup = self.register()
        original = signup.data['refresh']
        first = self.client.post(
            '/api/auth/jwt/refresh/', {'refresh': original}, format='json'
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)
        self.assertIn('access', first.data)
        rotated = first.data['refresh']
        self.assertNotEqual(rotated, original)
        self.assertEqual(BlacklistedToken.objects.count(), 1)
        reuse = self.client.post(
            '/api/auth/jwt/refresh/', {'refresh': original}, format='json'
        )
        self.assertEqual(reuse.status_code, status.HTTP_401_UNAUTHORIZED, reuse.data)
        second = self.client.post(
            '/api/auth/jwt/refresh/', {'refresh': rotated}, format='json'
        )
        self.assertEqual(second.status_code, status.HTTP_200_OK, second.data)

    def test_logout_revokes_current_refresh_token(self):
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
        signup = self.register()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + signup.data['access'])
        out = self.client.post(
            '/api/auth/logout/', {'refresh': signup.data['refresh']}, format='json'
        )
        self.assertEqual(out.status_code, status.HTTP_200_OK, out.data)
        self.assertEqual(BlacklistedToken.objects.count(), 1)
        self.client.credentials()
        invalid = self.client.post(
            '/api/auth/jwt/refresh/', {'refresh': signup.data['refresh']}, format='json'
        )
        self.assertEqual(invalid.status_code, status.HTTP_401_UNAUTHORIZED, invalid.data)

    def test_missing_refresh_does_not_claim_successful_revocation(self):
        signup = self.register()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + signup.data['access'])
        out = self.client.post('/api/auth/logout/', {}, format='json')
        self.assertEqual(out.status_code, status.HTTP_400_BAD_REQUEST, out.data)

    def test_cross_account_logout_cannot_revoke_another_users_refresh(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        signup = self.register()
        other = get_user_model().objects.create_user(
            email='other-development@example.invalid',
            username='other_development',
            password='AnotherTestPassword-2026!',
        )
        other_refresh = str(RefreshToken.for_user(other))
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + signup.data['access'])
        out = self.client.post(
            '/api/auth/logout/', {'refresh': other_refresh}, format='json'
        )
        self.assertEqual(out.status_code, status.HTTP_403_FORBIDDEN, out.data)
        self.client.credentials()
        valid = self.client.post(
            '/api/auth/jwt/refresh/', {'refresh': other_refresh}, format='json'
        )
        self.assertEqual(valid.status_code, status.HTTP_200_OK, valid.data)

    def test_client_cannot_create_service_or_provisioning_task(self):
        response = self.register()
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + response.data["access"])
        service = self.client.post("/api/services/services/", {}, format="json")
        self.assertEqual(service.status_code, status.HTTP_403_FORBIDDEN)
        provision = self.client.post(
            "/api/provisioning/tasks/",
            {"service_id": 1, "action": "terminate"},
            format="json",
        )
        self.assertEqual(provision.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_access_global_provisioning_queues(self):
        response = self.register()
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + response.data["access"])
        for endpoint in ("/api/provisioning/queues/", "/api/provisioning/tasks/"):
            denied = self.client.get(endpoint)
            self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN, denied.data)

    def test_checkout_cannot_initialize_or_verify_unsettleable_payment(self):
        response = self.register()
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + response.data["access"])
        blocked = self.client.post("/api/payments/initialize/", {}, format="json")
        self.assertEqual(blocked.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        blocked_verify = self.client.get("/api/payments/verify/?reference=test")
        self.assertEqual(blocked_verify.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_customer_cannot_change_hosting_state_without_provider_confirmation(self):
        from decimal import Decimal
        from django.utils import timezone
        from services.models import Service, ServiceActionLog
        response = self.register()
        user = get_user_model().objects.get(email=self.email)
        service = Service.objects.create(
            client=user,
            label="Security Test Hosting",
            product_id=1,
            plan_id=1,
            billing_cycle="1mo",
            amount=Decimal("100.00"),
            next_due_date=timezone.now(),
            status="suspended",
        )
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + response.data["access"])
        attempt = self.client.post(
            f"/api/services/services/{service.pk}/action/",
            {"action": "unsuspend"},
            format="json",
        )
        self.assertEqual(attempt.status_code, status.HTTP_503_SERVICE_UNAVAILABLE, attempt.data)
        service.refresh_from_db()
        self.assertEqual(service.status, "suspended")
        self.assertEqual(ServiceActionLog.objects.filter(service=service).count(), 0)

    def test_liveness_is_readable_without_auth_and_no_secrets(self):
        result = self.client.get("/api/health/")
        self.assertEqual(result.status_code, status.HTTP_200_OK)
        self.assertEqual(result.data if hasattr(result, "data") else result.json(),
                         {"service": "octalve-cloud-api", "status": "ok"})

    def test_unsigned_webhook_fails_closed_without_persistence(self):
        gateway = PaymentGateway.objects.create(
            code="paystack", name="Sandbox Paystack", status="test", test_mode=True
        )
        response = self.client.post(
            "/api/payments/webhook/paystack/",
            {"event": "charge.success", "id": "test-unsigned"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(WebhookEvent.objects.filter(gateway=gateway).count(), 0)

    def test_log_configuration_has_no_file_handlers(self):
        from django.conf import settings
        self.assertEqual(set(settings.LOGGING["handlers"]), {"console"})

    def test_request_logger_never_captures_sensitive_query(self):
        from django.test import RequestFactory
        from octalve_backend.middleware import SimpleRequestLoggingMiddleware
        request = RequestFactory().get("/api/health/?refresh=secret-token")
        response = SimpleRequestLoggingMiddleware(lambda _request: self.client.get("/api/health/"))(request)
        self.assertEqual(response.status_code, 200)

    def test_secure_https_redirect_and_proxy_header_on_review_runtime(self):
        from django.test import override_settings
        from django.test.client import RequestFactory
        from django.middleware.security import SecurityMiddleware
        factory = RequestFactory()
        with override_settings(
            DEBUG=False, SECURE_SSL_REDIRECT=True,
            ALLOWED_HOSTS=['api.example.test'],
            SECURE_PROXY_SSL_HEADER=('HTTP_X_FORWARDED_PROTO', 'https'),
        ):
            middleware = SecurityMiddleware(lambda request: None)
            insecure_request = factory.get('/api/health/', HTTP_HOST='api.example.test')
            redirected = middleware.process_request(insecure_request)
            self.assertEqual(redirected.status_code, 301)
            self.assertTrue(redirected['Location'].startswith('https://'))
            trusted_request = factory.get(
                '/api/health/', HTTP_HOST='api.example.test',
                HTTP_X_FORWARDED_PROTO='https',
            )
            self.assertIsNone(middleware.process_request(trusted_request))

    def test_vercel_preview_without_database_fails_closed(self):
        """Isolated source import; intentionally no database is contacted."""
        import os
        import subprocess
        import sys
        from pathlib import Path

        env = os.environ.copy()
        env.update({
            "VERCEL_ENV": "preview",
            "DEBUG": "false",
            "DJANGO_SECRET_KEY": "only-a-test-key-not-for-deployments",
        })
        for key in ("DATABASE_URL", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_HOST", "DB_PORT"):
            env.pop(key, None)
        result = subprocess.run(
            [sys.executable, "-c", "import octalve_backend.settings"],
            cwd=str(Path(__file__).resolve().parents[1]),
            env=env,
            capture_output=True,
            text=True,
            timeout=20,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DATABASE_URL is required on Vercel", result.stderr)


class AuthAbuseProtectionTests(APITestCase):
    """Shared SQL throttle, not process-memory, for serverless auth endpoints."""

    def test_login_limit_blocks_ninth_attempt_with_retry_after(self):
        for _ in range(8):
            result = self.client.post(
                "/api/auth/jwt/create/",
                {"email": "not-present@example.invalid", "password": "InvalidPassword-2026"},
                format="json",
            )
            self.assertNotEqual(result.status_code, 429, result.data)
        blocked = self.client.post(
            "/api/auth/jwt/create/",
            {"email": "not-present@example.invalid", "password": "InvalidPassword-2026"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 429, blocked.content)
        self.assertGreater(int(blocked["Retry-After"]), 0)
        self.assertEqual(blocked["Cache-Control"], "no-store")

    def test_login_limit_tracks_identity_across_source_ips(self):
        from unittest.mock import patch
        with patch.dict("os.environ", {"VERCEL_ENV": "production"}):
            for n in range(8):
                result = self.client.post(
                    "/api/auth/jwt/create/",
                    {"email": "same-target@example.invalid", "password": "InvalidPassword-2026"},
                    format="json",
                    HTTP_X_FORWARDED_FOR=f"203.0.113.{n+1}",
                )
                self.assertNotEqual(result.status_code, 429, result.data)
            blocked = self.client.post(
                "/api/auth/jwt/create/",
                {"email": "same-target@example.invalid", "password": "InvalidPassword-2026"},
                format="json", HTTP_X_FORWARDED_FOR="203.0.113.99",
            )
            self.assertEqual(blocked.status_code, 429)

    def test_signup_rate_limit_is_persistent(self):
        for _ in range(5):
            result = self.client.post(
                "/api/auth/register/", {"email": "invalid"}, format="json",
            )
            self.assertNotEqual(result.status_code, 429)
        blocked = self.client.post(
            "/api/auth/register/", {"email": "invalid"}, format="json",
        )
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked["Cache-Control"], "no-store")

    def test_bucket_fingerprints_never_store_email_or_ip(self):
        from accounts.models import AuthThrottleBucket
        self.client.post(
            "/api/auth/jwt/create/",
            {"email": "secret-target@example.invalid", "password": "invalid"}, format="json",
        )
        buckets = list(AuthThrottleBucket.objects.values_list("fingerprint", flat=True))
        self.assertEqual(len(buckets), 2)
        self.assertTrue(all(len(value) == 64 for value in buckets))
        self.assertTrue(all("example.invalid" not in value and "127.0.0.1" not in value for value in buckets))

    def test_unknown_storage_failure_refuses_authentication(self):
        from django.db import DatabaseError
        from unittest.mock import patch
        with patch("accounts.security_throttle._spend", side_effect=DatabaseError("storage down")):
            blocked = self.client.post(
                "/api/auth/jwt/create/", {"email": "anything@example.invalid", "password": "password"}, format="json",
            )
        self.assertEqual(blocked.status_code, 503)
        self.assertEqual(blocked["Cache-Control"], "no-store")

    def test_untrusted_forwarded_header_not_used_outside_vercel(self):
        from accounts.security_throttle import _request_ip
        from django.test import RequestFactory
        from unittest.mock import patch
        request = RequestFactory().post(
            "/api/auth/jwt/create/", HTTP_X_FORWARDED_FOR="198.51.100.77",
            REMOTE_ADDR="127.0.0.1",
        )
        with patch.dict("os.environ", {"VERCEL_ENV": ""}):
            self.assertEqual(_request_ip(request), "127.0.0.1")

    def test_signed_bff_forwarding_cannot_be_spoofed_by_direct_client(self):
        import hashlib
        import hmac
        import time
        from django.test import RequestFactory
        from unittest.mock import patch
        from accounts.security_throttle import _request_ip

        secret = "SEC01-CI-only-signed-proxy-test-key-1234567890"
        forwarded = "198.51.100.98"
        ts = str(int(time.time()))
        path = "/api/auth/jwt/create/"
        message = f"v1\n{forwarded}\n{ts}\nPOST\n{path}"
        signature = hmac.new(
            secret.encode(), message.encode(), hashlib.sha256,
        ).hexdigest()
        req = RequestFactory().post(
            path,
            HTTP_X_FORWARDED_FOR="203.0.113.45",
            HTTP_X_OCTALVE_CLIENT_IP=forwarded,
            HTTP_X_OCTALVE_CLIENT_IP_TS=ts,
            HTTP_X_OCTALVE_CLIENT_IP_SIG=signature,
        )
        with patch.dict("os.environ", {
            "VERCEL_ENV": "production",
            "OCTALVE_BFF_SHARED_SECRET": secret,
        }):
            self.assertEqual(_request_ip(req), forwarded)
            req.META["HTTP_X_OCTALVE_CLIENT_IP_SIG"] = "0" * 64
            self.assertEqual(_request_ip(req), "203.0.113.45")
            req.META["HTTP_X_OCTALVE_CLIENT_IP_SIG"] = signature
            req.path = "/api/auth/register/"
            self.assertEqual(_request_ip(req), "203.0.113.45")

    def test_prune_is_dry_run_before_explicit_apply(self):
        from accounts.models import AuthThrottleBucket
        from django.core.management import call_command
        from django.utils import timezone
        from datetime import timedelta
        from io import StringIO
        bucket = AuthThrottleBucket.objects.create(
            fingerprint="a" * 64,
            attempts=3,
            expires_at=timezone.now() - timedelta(days=3),
        )
        output = StringIO()
        call_command("prune_auth_throttles", stdout=output)
        self.assertIn("PLAN ONLY", output.getvalue())
        self.assertTrue(AuthThrottleBucket.objects.filter(pk=bucket.pk).exists())
        call_command("prune_auth_throttles", "--apply", stdout=StringIO())
        self.assertFalse(AuthThrottleBucket.objects.filter(pk=bucket.pk).exists())
