"""No-network, no-provisioning vendor read-back and lifecycle regression."""
from datetime import timedelta
from decimal import Decimal
from unittest.mock import Mock, patch
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from providers.models import Provider
from services.models import Service
from .models import VerifiedHostingBinding
from .policy import eligible
from .readback import (
    ReadbackRejected, readback_service, verify_existing_account,
    _da_account, _whm_account,
)

DA_REPLY = "error=0&username=checkhost&domain=verified.example.test&usertype=user&account=ON&suspended=no"
WHM_REPLY = {"metadata": {"result": 1}, "data": {"acct": [
    {"user": "checkhost", "domain": "verified.example.test", "suspended": 0},
]}}


def vendor_response(body, status=200):
    result = Mock(status_code=status)
    if isinstance(body, dict):
        import json
        result.content = json.dumps(body).encode()
        result.text = result.content.decode()
        result.json.return_value = body
    else:
        result.content = str(body).encode()
        result.text = str(body)
        result.json.side_effect = ValueError("not JSON")
    return result


@override_settings(OPANEL_READBACK_ENABLED=True)
class VerifiedAccountReadbackTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(
            email="readback@example.test", username="readback",
            role="client", password="local-test-just-for-ci")
        self.provider = Provider.objects.create(
            name="Isolated WHM", adapter_type="CpanelAdapter",
            base_url="https://whm.verified-host.test:2087",
            username="least-privilege-operator",
            status="active", health_status="healthy",
            test_mode=False, timeout_seconds=4,
        )
        self.service = Service.objects.create(
            client=user, product_id=1, plan_id=1,
            provider_id=self.provider.pk, service_type="hosting",
            status="active", label="Readback fixture",
            domain_name="verified.example.test", provider_identifier="checkhost",
            activated_at=timezone.now()-timedelta(minutes=5),
            billing_cycle="1mo", amount=Decimal("3000"), currency="NGN",
            next_due_date=timezone.now()+timedelta(days=30),
        )
        self.getter = Mock(return_value=vendor_response(WHM_REPLY))
        self.token = patch.object(Provider, "get_api_key", return_value="secret-test-only")
        self.hosts = patch.dict("os.environ", {"CLOUD_INVENTORY_ALLOWED_HOSTS": "whm.verified-host.test,da.verified-host.test"})
        self.token.start()
        self.hosts.start()
        self.addCleanup(self.token.stop)
        self.addCleanup(self.hosts.stop)

    def test_whm_readback_is_exact_one_get_and_dry_run_no_db_write(self):
        proof = readback_service(self.service.pk, apply=False, getter=self.getter)
        self.assertTrue(proof.account_confirmed)
        self.assertFalse(VerifiedHostingBinding.objects.exists())
        args, kw = self.getter.call_args
        self.assertEqual(args[0], "https://whm.verified-host.test:2087/json-api/accountsummary")
        self.assertEqual(kw["params"], {"api.version": "1", "user": "checkhost"})
        self.assertTrue(kw["verify"])
        self.assertFalse(kw["allow_redirects"])
        self.assertLessEqual(kw["timeout"], 10)
        self.assertNotIn("secret-test-only", str(proof))

    def test_apply_verified_proof_only_after_vendor_success(self):
        readback_service(self.service.pk, apply=True, getter=self.getter)
        proof = VerifiedHostingBinding.objects.get(service=self.service)
        self.assertEqual(proof.confirmation_source, "provider_api_readback")
        self.assertIsNotNone(eligible(self.service.client_id, self.service.pk))
        self.assertLessEqual((timezone.now()-proof.confirmed_at).total_seconds(), 10)

    def test_exact_directadmin_readback(self):
        self.provider.adapter_type = "DirectAdminAdapter"
        self.provider.base_url = "https://da.verified-host.test:2222"
        self.provider.save(update_fields=["adapter_type", "base_url"])
        self.getter.return_value = vendor_response(DA_REPLY)
        result = verify_existing_account(self.service, self.provider, getter=self.getter)
        self.assertTrue(result.account_confirmed)
        args, kw = self.getter.call_args
        self.assertEqual(args[0], "https://da.verified-host.test:2222/CMD_API_SHOW_USER_CONFIG")
        self.assertEqual(kw["params"], {"user": "checkhost"})
        self.assertTrue(kw["headers"]["Authorization"].startswith("Basic "))

    def test_vendor_errors_and_suspensions_never_create_false_proof(self):
        bad = [
            vendor_response({"metadata": {"result": 0}, "data": {"acct": WHM_REPLY["data"]["acct"]}}),
            vendor_response({"metadata": {"result": 1}, "data": {"acct": []}}),
            vendor_response({"metadata": {"result": 1}, "data": {"acct": [dict(WHM_REPLY["data"]["acct"][0], suspended=1)]}}),
            vendor_response({"metadata": {"result": 1}, "data": {"acct": [dict(WHM_REPLY["data"]["acct"][0], domain="wrong.test")]}}),
            vendor_response({"metadata": {"result": 1}, "data": {"acct": [dict(WHM_REPLY["data"]["acct"][0], user="different")]}}),
            vendor_response(WHM_REPLY, status=302),
            vendor_response(WHM_REPLY, status=403),
            vendor_response("not JSON"),
        ]
        for response in bad:
            with self.subTest(status=response.status_code, data=response.text[:50]):
                self.getter.return_value = response
                with self.assertRaises(ReadbackRejected):
                    readback_service(self.service.pk, apply=True, getter=self.getter)
                self.assertFalse(VerifiedHostingBinding.objects.exists())

    def test_failed_recheck_revokes_existing_proof_immediately(self):
        readback_service(self.service.pk, apply=True, getter=self.getter)
        self.assertIsNotNone(eligible(self.service.client_id, self.service.pk))
        self.getter.return_value = vendor_response({
            "metadata": {"result": 1}, "data": {"acct": [
                {"user": "checkhost", "domain": "verified.example.test", "suspended": 1},
            ]}
        })
        with self.assertRaises(ReadbackRejected):
            readback_service(self.service.pk, apply=True, getter=self.getter)
        self.assertIsNone(eligible(self.service.client_id, self.service.pk))
        self.assertIsNotNone(VerifiedHostingBinding.objects.get(service=self.service).revoked_at)

    def test_bad_provider_endpoint_and_unhealthy_provider_block_network(self):
        self.provider.base_url = "https://other-provider.test:2087"
        self.provider.save(update_fields=["base_url"])
        with self.assertRaises(ReadbackRejected):
            verify_existing_account(self.service, self.provider, getter=self.getter)
        self.getter.assert_not_called()
        self.provider.base_url = "https://whm.verified-host.test:2087"
        self.provider.health_status = "unhealthy"
        self.provider.save(update_fields=["base_url", "health_status"])
        with self.assertRaises(ReadbackRejected):
            verify_existing_account(self.service, self.provider, getter=self.getter)
        self.getter.assert_not_called()

    def test_wrong_status_and_expired_term_block_vendor_network(self):
        self.service.status = "suspended"
        self.service.save(update_fields=["status"])
        with self.assertRaises(ReadbackRejected):
            verify_existing_account(self.service, self.provider, getter=self.getter)
        self.service.status = "active"
        self.service.next_due_date = timezone.now()-timedelta(minutes=1)
        self.service.save(update_fields=["status", "next_due_date"])
        with self.assertRaises(ReadbackRejected):
            verify_existing_account(self.service, self.provider, getter=self.getter)
        self.getter.assert_not_called()

    def test_proof_expires_without_recent_provider_readback(self):
        readback_service(self.service.pk, apply=True, getter=self.getter)
        VerifiedHostingBinding.objects.update(confirmed_at=timezone.now()-timedelta(minutes=16))
        self.assertIsNone(eligible(self.service.client_id, self.service.pk))

    def test_reactivation_rotates_binding_identifier(self):
        readback_service(self.service.pk, apply=True, getter=self.getter)
        old = str(VerifiedHostingBinding.objects.get(service=self.service).binding_ref)
        VerifiedHostingBinding.objects.update(revoked_at=timezone.now())
        readback_service(self.service.pk, apply=True, getter=self.getter)
        current = VerifiedHostingBinding.objects.get(service=self.service)
        self.assertNotEqual(str(current.binding_ref), old)
        self.assertIsNone(current.revoked_at)

    def test_readback_rejects_mutation_during_vendor_request(self):
        def mutate(*a, **kw):
            Service.objects.filter(pk=self.service.pk).update(status="suspended")
            return vendor_response(WHM_REPLY)
        with self.assertRaises(ReadbackRejected):
            readback_service(self.service.pk, apply=True, getter=mutate)
        self.assertFalse(VerifiedHostingBinding.objects.exists())

    def test_invalid_directadmin_response_must_fail_closed(self):
        for text in (
            "error=1&username=checkhost&domain=verified.example.test&usertype=user&account=ON&suspended=no",
            DA_REPLY.replace("suspended=no", "suspended=yes"),
            DA_REPLY.replace("account=ON", "account=OFF"),
            DA_REPLY.replace("usertype=user", "usertype=admin"),
            DA_REPLY.replace("domain=verified.example.test", "domain=unrelated.example.test"),
            DA_REPLY + "&username=ambiguous",
        ):
            with self.subTest(text=text):
                with self.assertRaises(ReadbackRejected):
                    _da_account(text, "checkhost", "verified.example.test")

    @override_settings(
        OPANEL_ISSUER_ENABLED=True,
        OPANEL_CLIENT_SECRET="local-only-sso-integration-secret-0123456789abcdef",
        OPANEL_CLIENT_ID="octalve-opanel",
        OPANEL_CALLBACK_URL="https://panel.example.test/auth/callback/",
    )
    def test_provider_readback_then_console_sso_then_revocation(self):
        """Synthetic end-to-end provider proof -> Console issuer -> entitlement denial."""
        import base64
        import hashlib
        from rest_framework.test import APIClient
        verifier = "x" * 50
        challenge = base64.urlsafe_b64encode(
            hashlib.sha256(verifier.encode()).digest()
        ).rstrip(b"=").decode()
        customer = APIClient()
        customer.force_authenticate(self.service.client)
        path = "/api/integrations/opanel/v1/"
        def issue():
            return customer.post(path+"authorize/", {
                "service_id": self.service.pk,
                "state": "s" * 32, "code_challenge": challenge,
            }, format="json")
        def exchange(code):
            external = APIClient()
            return external.post(path+"exchange/", {
                "code": code, "code_verifier": verifier,
                "redirect_uri": "https://panel.example.test/auth/callback/",
            }, format="json", HTTP_AUTHORIZATION="Bearer local-only-sso-integration-secret-0123456789abcdef",
                HTTP_X_OPANEL_CLIENT_ID="octalve-opanel")
        def current():
            external = APIClient()
            return external.post(path+"entitlement/", {
                "subject_id": self.service.client_id,
                "service_id": self.service.pk,
            }, format="json", HTTP_AUTHORIZATION="Bearer local-only-sso-integration-secret-0123456789abcdef",
                HTTP_X_OPANEL_CLIENT_ID="octalve-opanel")
        self.assertEqual(issue().status_code, 404)
        readback_service(self.service.pk, apply=False, getter=self.getter)
        self.assertEqual(issue().status_code, 404)
        readback_service(self.service.pk, apply=True, getter=self.getter)
        self.assertEqual(current().status_code, 200)
        code = issue().data["code"]
        self.assertEqual(exchange(code).status_code, 200)
        self.assertEqual(exchange(code).status_code, 403)
        issued_before_revocation = issue().data["code"]
        self.getter.return_value = vendor_response({
            "metadata": {"result": 1}, "data": {"acct": [{
                "user": "checkhost", "domain": "verified.example.test",
                "suspended": 1,
            }]}
        })
        with self.assertRaises(ReadbackRejected):
            readback_service(self.service.pk, apply=True, getter=self.getter)
        self.assertEqual(current().status_code, 404)
        self.assertEqual(issue().status_code, 404)
        self.assertEqual(exchange(issued_before_revocation).status_code, 403)

    def test_wrong_whm_summary_schema_fails_closed(self):
        with self.assertRaises(ReadbackRejected):
            _whm_account({"metadata": {"result": 1}, "data": {"acct": [{}, {}]}},
                         "checkhost", "verified.example.test")
