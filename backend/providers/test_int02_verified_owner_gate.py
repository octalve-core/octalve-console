"""Provider-vault authority must be independent of the Django superuser bit alone."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient


class VerifiedOwnerVaultTests(TestCase):
    def test_role_flags_without_verified_email_cannot_read_vault_metadata(self):
        owner = get_user_model().objects.create_superuser(
            email="unverified-vault-owner@example.invalid",
            username="int02_unverified_owner",
            password="CI-test-only-password-no-real-secrets",
        )
        client = APIClient()
        client.force_authenticate(user=owner)
        for path in (
            "/api/providers/security/stepup/",
            "/api/providers/connections/",
            "/api/providers/connections/schemas/",
        ):
            with self.subTest(path=path):
                self.assertEqual(client.get(path).status_code, 403)

        owner.email_verified_at = timezone.now()
        owner.save(update_fields=["email_verified_at"])
        client.force_authenticate(user=owner)
        self.assertEqual(client.get("/api/providers/connections/schemas/").status_code, 200)
