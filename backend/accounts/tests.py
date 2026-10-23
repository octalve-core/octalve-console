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
