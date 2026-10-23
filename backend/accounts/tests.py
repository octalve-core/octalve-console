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

    def test_unsigned_webhook_fails_closed_without_persistence(self):
        gateway = PaymentGateway.objects.create(
            code="paystack", name="Sandbox Paystack", status="test", test_mode=True
        )
        response = self.client.post(
            "/api/payments/webhook/paystack/",
            {"event": "charge.success", "id": "test-unsigned"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(WebhookEvent.objects.filter(gateway=gateway).count(), 0)
