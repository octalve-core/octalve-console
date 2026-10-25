"""No-money and no-provider regression for Console's independent OPanel SSO issuer."""
import base64
import hashlib
from datetime import timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from services.models import Service
from providers.models import Provider
from .models import OPanelLaunchGrant, VerifiedHostingBinding
from .policy import account_digest

SECRET = "local-integration-test-secret-only-0123456789abcdef"
CALLBACK = "https://panel.example.test/auth/callback/"
VERIFIER = "a" * 48
CHALLENGE = base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode()).digest()).rstrip(b"=").decode()
ISSUE = "/api/integrations/opanel/v1/authorize/"
EXCHANGE = "/api/integrations/opanel/v1/exchange/"
ENTITLEMENT = "/api/integrations/opanel/v1/entitlement/"


@override_settings(OPANEL_ISSUER_ENABLED=True, OPANEL_CLIENT_SECRET=SECRET,
                   OPANEL_CLIENT_ID="octalve-opanel", OPANEL_CALLBACK_URL=CALLBACK)
class OPanelIssuerTests(TestCase):
    def setUp(self):
        users = get_user_model()
        self.owner = users.objects.create_user(
            email="owner-sso@example.test", username="ssoowner",
            password="local-test-password-123", role="client")
        self.stranger = users.objects.create_user(
            email="stranger-sso@example.test", username="ssostranger",
            password="local-test-password-123", role="client")
        now = timezone.now()
        self.provider = Provider.objects.create(
            name="Synthetic verification provider",
            adapter_type="CpanelAdapter",
            base_url="https://test-host.example.test:2087",
            username="operator",
            config={"hosting_account_owner": "resellerops"},
            status="active", health_status="healthy", test_mode=False,
        )
        self.service = Service.objects.create(
            client=self.owner, product_id=1, plan_id=2, provider_id=self.provider.pk,
            status="active", label="Test Hosting", service_type="hosting",
            domain_name="safe.example.test", provider_identifier="server-only-account",
            activated_at=now - timedelta(minutes=10), next_due_date=now + timedelta(days=30),
            billing_cycle="1mo", amount=Decimal("3000"), currency="NGN")
        self.proof = VerifiedHostingBinding.objects.create(
            service=self.service, provider_id_snapshot=self.provider.pk, account_digest=account_digest(self.service),
            confirmation_source="provider_api_readback", confirmed_at=now - timedelta(minutes=1))
        self.api = APIClient()
        self.api.force_authenticate(self.owner)

    def issue(self):
        return self.api.post(ISSUE, {
            "service_id": self.service.pk,
            "state": "A" * 32, "code_challenge": CHALLENGE,
        }, format="json")

    def confidential(self, path, data, secret=SECRET):
        api = APIClient()
        return api.post(path, data, format="json", HTTP_AUTHORIZATION=f"Bearer {secret}",
                        HTTP_X_OPANEL_CLIENT_ID="octalve-opanel")

    def redeem(self, code, verifier=VERIFIER):
        return self.confidential(EXCHANGE, {
            "code": code, "code_verifier": verifier, "redirect_uri": CALLBACK,
        })

    def test_issued_grant_is_random_hashed_single_use_and_service_bound(self):
        issued = self.issue()
        self.assertEqual(issued.status_code, 200, issued.data)
        code = issued.data["code"]
        self.assertNotIn(code, OPanelLaunchGrant.objects.values_list("code_digest", flat=True))
        self.assertEqual(issued.data["redirect_uri"], CALLBACK)
        redeemed = self.redeem(code)
        self.assertEqual(redeemed.status_code, 200, redeemed.data)
        self.assertEqual(redeemed.data["subject_id"], self.owner.pk)
        self.assertEqual(redeemed.data["service_id"], self.service.pk)
        self.assertEqual(redeemed.data["capabilities"], ["overview"])
        self.assertNotIn("provider_identifier", redeemed.data)
        self.assertNotIn("credentials", redeemed.data)
        self.assertEqual(self.redeem(code).status_code, 403)

    def test_wrong_passwordless_client_and_pkce_mismatch_fail(self):
        code = self.issue().data["code"]
        self.assertEqual(self.confidential(EXCHANGE, {
            "code": code, "code_verifier": VERIFIER, "redirect_uri": CALLBACK,
        }, secret="not-the-accepted-secret").status_code, 401)
        self.assertEqual(self.redeem(code, verifier="b" * 48).status_code, 403)
        # Failed verifier does not consume the grant (denial of service prevention).
        self.assertEqual(self.redeem(code).status_code, 200)

    def test_expiration_replay_and_redirect_uri_tampering(self):
        code = self.issue().data["code"]
        self.assertEqual(self.confidential(EXCHANGE, {
            "code": code, "code_verifier": VERIFIER, "redirect_uri": "https://evil.example/auth/callback/",
        }).status_code, 400)
        OPanelLaunchGrant.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.redeem(code).status_code, 403)

    def test_customer_must_own_service_even_if_knows_its_id(self):
        self.api.force_authenticate(self.stranger)
        self.assertEqual(self.issue().status_code, 404)
        self.assertEqual(self.confidential(ENTITLEMENT, {
            "subject_id": self.stranger.pk, "service_id": self.service.pk,
        }).status_code, 404)

    def test_staff_cannot_launch_as_customer(self):
        self.owner.role = "staff"
        self.owner.save(update_fields=["role"])
        self.assertEqual(self.issue().status_code, 404)

    def test_pending_suspended_expired_unprovisioned_and_revoked_fail(self):
        for value in ("pending", "provisioning", "suspended", "cancelled", "terminated", "expired", "failed"):
            with self.subTest(status=value):
                self.service.status = value
                self.service.save(update_fields=["status"])
                self.assertEqual(self.issue().status_code, 404)
        self.service.status = "active"
        self.service.save(update_fields=["status"])
        self.service.next_due_date = timezone.now() - timedelta(seconds=1)
        self.service.save(update_fields=["next_due_date"])
        self.assertEqual(self.issue().status_code, 404)
        self.service.next_due_date = timezone.now() + timedelta(days=30)
        self.service.save(update_fields=["next_due_date"])
        self.proof.revoked_at = timezone.now()
        self.proof.save(update_fields=["revoked_at"])
        self.assertEqual(self.issue().status_code, 404)

    def test_active_provider_identifier_alone_is_not_eligibility(self):
        self.proof.delete()
        self.assertEqual(self.issue().status_code, 404)

    def test_changed_provider_account_breaks_entitlement_and_unused_code(self):
        code = self.issue().data["code"]
        self.service.provider_identifier = "different-provider-account"
        self.service.save(update_fields=["provider_identifier"])
        self.assertEqual(self.redeem(code).status_code, 403)
        self.assertEqual(self.confidential(ENTITLEMENT, {
            "subject_id": self.owner.pk, "service_id": self.service.pk,
        }).status_code, 404)

    def test_suspend_after_issue_blocks_redemption_and_live_checks(self):
        code = self.issue().data["code"]
        self.service.status = "suspended"
        self.service.save(update_fields=["status"])
        self.assertEqual(self.redeem(code).status_code, 403)
        self.assertEqual(self.confidential(ENTITLEMENT, {
            "subject_id": self.owner.pk, "service_id": self.service.pk,
        }).status_code, 404)

    def test_unconfigured_client_credentials_fail_closed(self):
        with override_settings(OPANEL_CLIENT_SECRET=""):
            self.assertEqual(self.issue().status_code, 503)
            self.assertEqual(self.confidential(ENTITLEMENT, {
                "subject_id": self.owner.pk, "service_id": self.service.pk,
            }).status_code, 401)

    def test_anonymous_authorization_is_denied(self):
        self.api.force_authenticate(user=None)
        self.assertIn(self.issue().status_code, (401, 403))

    def test_modified_provider_credentials_or_origin_invalidate_current_grant(self):
        code = self.issue().data["code"]
        self.provider.base_url = "https://other.example.test:2087"
        self.provider.save(update_fields=["base_url"])
        self.assertEqual(self.redeem(code).status_code, 403)
        self.assertEqual(self.issue().status_code, 404)

    def test_unhealthy_provider_disables_active_service_sso(self):
        self.provider.health_status = "unhealthy"
        self.provider.save(update_fields=["health_status"])
        self.assertEqual(self.issue().status_code, 404)

    def test_duplicate_provider_account_bound_to_another_customer_fails_closed(self):
        Service.objects.create(
            client=self.stranger, product_id=1, plan_id=2, provider_id=self.provider.pk,
            status="active", label="Conflicting account", service_type="hosting",
            domain_name="safe.example.test", provider_identifier="SERVER-ONLY-ACCOUNT",
            activated_at=timezone.now()-timedelta(minutes=10),
            next_due_date=timezone.now()+timedelta(days=30),
            billing_cycle="1mo", amount=Decimal("3000"), currency="NGN",
        )
        self.assertEqual(self.issue().status_code, 404)
        self.assertEqual(self.confidential(ENTITLEMENT, {
            "subject_id": self.owner.pk, "service_id": self.service.pk,
        }).status_code, 404)
