from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from services.models import Service, ServiceUsage, ServiceCredential


class OPanelIsolationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        user = get_user_model()
        cls.owner = user.objects.create_user(
            email='opanel-owner@example.test', username='opanelowner',
            password='TestPassword_123', role='client')
        cls.other = user.objects.create_user(
            email='opanel-other@example.test', username='opanelother',
            password='TestPassword_123', role='client')
        cls.service = Service.objects.create(
            client=cls.owner, product_id=1, plan_id=2, provider_id=3,
            status='active', label='Web Hosting', service_type='hosting',
            domain_name='mybusiness.example', provider_identifier='private-provider-account',
            billing_cycle='1mo', amount=Decimal('3000'), currency='NGN',
            next_due_date=timezone.now()+timedelta(days=30))
        ServiceUsage.objects.create(
            service=cls.service, disk_used_mb=512, disk_limit_mb=4096,
            bandwidth_used_mb=100, bandwidth_limit_mb=10240)

    def setUp(self):
        self.api=APIClient()

    def test_owner_sees_redacted_real_service_overview_not_provider_credentials(self):
        self.api.force_authenticate(self.owner)
        response=self.api.get(f'/api/services/opanel/{self.service.pk}/overview/')
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(response.data['usage']['disk_used_mb'],512)
        self.assertEqual(response.data['billing']['amount'],'3000.00')
        self.assertEqual(response.data['billing']['currency'],'NGN')
        self.assertEqual(response.data['billing']['cycle'],'1mo')
        self.assertIsNone(response.data['domain_id'])
        self.assertFalse(response.data['capabilities']['files'])
        self.assertFalse(response.data['capabilities']['dns'])
        self.assertNotIn('provider_identifier',response.data)
        self.assertNotIn('credentials',response.data)

    def test_local_active_status_is_not_fresh_provider_proof(self):
        self.api.force_authenticate(self.owner)
        response=self.api.get(f'/api/services/opanel/{self.service.pk}/overview/')
        self.assertEqual(response.status_code,200)
        # Synthetic service has a provider username but no live binding.
        self.assertEqual(response.data["status"],"active")
        self.assertFalse(response.data["active"])
        self.assertFalse(response.data["hosting_account_verified"])
        self.assertEqual(response.data["dns_public_status"],"unverified")
        self.assertEqual(response.data["website_public_status"],"unverified")
        self.assertFalse(response.data["capabilities"]["files"])

    def test_unrelated_customer_cannot_enumerate_service(self):
        self.api.force_authenticate(self.other)
        response=self.api.get(f'/api/services/opanel/{self.service.pk}/overview/')
        self.assertEqual(response.status_code,404)

    def test_unauthenticated_client_is_denied(self):
        response=self.api.get(f'/api/services/opanel/{self.service.pk}/overview/')
        self.assertIn(response.status_code,(401,403))

    def test_pending_service_does_not_claim_panel_access(self):
        self.service.status='pending'
        self.service.save(update_fields=['status'])
        self.api.force_authenticate(self.owner)
        response=self.api.get(f'/api/services/opanel/{self.service.pk}/overview/')
        self.assertEqual(response.status_code,200)
        self.assertFalse(response.data['active'])
        self.assertFalse(response.data['capabilities']['panel_sso'])

    def test_generic_service_endpoints_never_expose_hosting_credentials_or_provider_config(self):
        self.service.config = {'api_key': 'must-never-leak-provider-api-key'}
        self.service.save(update_fields=['config'])
        ServiceCredential.objects.create(
            service=self.service, username='private-host-username',
            encrypted_password='private-host-encrypted-password',
            metadata={'admin_token': 'must-never-leak-admin-token'},
        )
        self.api.force_authenticate(self.owner)
        response = self.api.get(f'/api/services/services/{self.service.pk}/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotIn('credentials', response.data)
        self.assertNotIn('config', response.data)
        body = str(response.data)
        for secret in ['private-host-username', 'must-never-leak-admin-token',
                       'must-never-leak-provider-api-key', 'private-host-encrypted-password']:
            self.assertNotIn(secret, body)
        blocked = self.api.get(f'/api/services/services/{self.service.pk}/credentials/')
        self.assertEqual(blocked.status_code, 503)
        self.assertNotIn('username', str(blocked.data))
        self.assertEqual(self.api.post(
            f'/api/services/services/{self.service.pk}/update_credentials/',
            {'password': 'attempt-exposed'}, format='json').status_code, 403)

    def test_customer_readiness_never_claims_public_dns_tls_or_website(self):
        self.api.force_authenticate(self.owner)
        response=self.api.get(f'/api/services/opanel/{self.service.pk}/overview/')
        self.assertEqual(response.status_code,200,response.data)
        self.assertEqual(response.data["readiness"]["hosting_account"],"pending")
        self.assertEqual(response.data["readiness"]["panel_access"],"unavailable")
        self.assertEqual(response.data["readiness"]["public_https"],"unverified")
        self.assertEqual(response.data["readiness"]["domain_dns"],"unverified")
        self.assertEqual(response.data["readiness"]["public_website"],"unverified")
        self.assertFalse(response.data["capabilities"]["files"])
        self.assertFalse(response.data["capabilities"]["panel_sso"])
        self.assertIn("no-store",response["Cache-Control"])
        self.assertNotIn("provider_identifier",str(response.data))

    def test_staff_admin_and_other_clients_cannot_use_customer_hosting_status(self):
        accounts=get_user_model()
        staff=accounts.objects.create_user(email="staff-b3@example.invalid",
            username="staffb3",password="StrongTestPassword123!",role="staff")
        admin=accounts.objects.create_user(email="admin-b3@example.invalid",
            username="adminb3",password="StrongTestPassword123!",role="admin")
        for user in (self.other,staff,admin):
            with self.subTest(role=user.role):
                self.api.force_authenticate(user)
                response=self.api.get(f'/api/services/opanel/{self.service.pk}/overview/')
                self.assertEqual(response.status_code,404,response.data)

    def test_disabled_owner_does_not_receive_customer_hosting_status(self):
        self.owner.is_active=False
        self.owner.save(update_fields=["is_active"])
        self.api.force_authenticate(self.owner)
        result=self.api.get(f'/api/services/opanel/{self.service.pk}/overview/')
        self.assertEqual(result.status_code,404)


class NativePanelProtocolTests(TestCase):
    def whm_response(self, **changes):
        import json
        from providers.pinned_egress import SupplierReadResponse
        session = "checkhost:session123:create_user_session,abc"
        from urllib.parse import urlencode
        data = {
            "service": "cpaneld",
            "session": session,
            "cp_security_token": "/cpsess1234567890",
            "expires": int(timezone.now().timestamp()) + 120,
            "url": "https://supplier.example.test:2083/cpsess1234567890/login?" + urlencode({"session": session}),
        }
        data.update(changes)
        return SupplierReadResponse(200, json.dumps({
            "metadata": {"command": "create_user_session", "result": 1}, "data": data,
        }).encode())

    def test_whm_accepts_only_customer_session_on_pinned_origin(self):
        from services.native_panel import parse_session, NativePanelRefused
        origin = "https://supplier.example.test:2087"
        self.assertTrue(parse_session(self.whm_response(), origin, "cpanel-whm", "checkhost").startswith("https://supplier.example.test:2083/"))
        for changes in (
            {"url": "https://evil.example.test:2083/cpsess1234567890/login?session=wrong"},
            {"service": "whostmgrd"}, {"session": "root:session123"},
            {"expires": int(timezone.now().timestamp()) - 1},
        ):
            with self.subTest(changes=changes), self.assertRaises(NativePanelRefused):
                parse_session(self.whm_response(**changes), origin, "cpanel-whm", "checkhost")

    def test_directadmin_rejects_redirect_and_non_session_path(self):
        from urllib.parse import urlencode
        from providers.pinned_egress import SupplierReadResponse
        from services.native_panel import parse_session, NativePanelRefused
        origin = "https://supplier.example.test:2222"
        valid = origin + "/api/login/url?key=" + "x" * 40
        def reply(url):
            return SupplierReadResponse(200, urlencode({"error": "0", "details": url}).encode())
        self.assertEqual(parse_session(reply(valid), origin, "directadmin", "checkhost"), valid)
        for url in (valid.replace("supplier.example.test", "evil.example.test"),
                    valid.replace("https:", "http:"), valid + "&next=evil",
                    valid.replace("/api/login/url", "/CMD_ADMIN_SETTINGS")):
            with self.subTest(url=url), self.assertRaises(NativePanelRefused):
                parse_session(reply(url), origin, "directadmin", "checkhost")

    def test_native_launch_cannot_use_unverified_or_unowned_service(self):
        from unittest.mock import patch
        from services.native_panel import launch, NativePanelRefused
        with patch("services.native_panel.eligible", return_value=None), patch(
                "services.native_panel.refresh_candidate", return_value=None), patch(
                "services.native_panel._session_request") as sender:
            with self.assertRaises(NativePanelRefused):
                launch(1, 2)
            sender.assert_not_called()

    def test_native_policy_must_explicitly_allow(self):
        from unittest.mock import patch
        from services.native_panel import _policy, NativePanelRefused
        with patch("services.native_panel.load_hosting_connection", return_value=(None, "test-token", {})):
            with self.assertRaises(NativePanelRefused):
                _policy(None)


    def test_whm_session_strips_optional_vendor_navigation(self):
        from urllib.parse import parse_qs, urlsplit
        from services.native_panel import parse_session
        response = self.whm_response()
        original = response.json()["data"]["url"]
        output = parse_session(self.whm_response(url=original + "&locale=en&goto_uri=%2Ffrontend%2Fjupiter"),
                               "https://supplier.example.test:2087", "cpanel-whm", "checkhost")
        self.assertEqual(set(parse_qs(urlsplit(output).query)), {"session"})

    def test_concurrent_revocation_discards_already_minted_url(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        from services.native_panel import launch, NativePanelRefused
        service = SimpleNamespace(pk=2, provider_id=3, provider_identifier="checkhost",
                                  provider_package_id="basic", domain_name="example.test")
        proof = SimpleNamespace(pk=4, confirmed_at=timezone.now(), account_digest="same")
        provider = SimpleNamespace(config={})
        row = SimpleNamespace(pk="connection", current_version=1, adapter_key="cpanel-whm",
                              public_settings={"server_url": "https://supplier.example.test:2087"})
        with patch("services.native_panel.eligible", side_effect=[(service, proof), (service, proof), None]), patch(
                "services.native_panel.refresh_owned_entitlement", return_value=(service, proof)), patch(
                "services.native_panel.Provider.objects.get", return_value=provider), patch(
                "services.native_panel._policy", return_value=(row, "synthetic-token")), patch(
                "services.native_panel._spend", return_value=False), patch(
                "services.native_panel.verify_existing_account"), patch(
                "services.native_panel._session_request", return_value=self.whm_response()) as mint:
            with self.assertRaises(NativePanelRefused):
                launch(1, 2)
            mint.assert_called_once()

    def test_http_launch_refuses_unverified_and_cross_tenant_customers(self):
        from unittest.mock import patch
        user = get_user_model()
        owner = user.objects.create_user(email="native-owner@example.test", username="nativeowner",
                                         password="TestPassword_123", role="client")
        other = user.objects.create_user(email="native-other@example.test", username="nativeother",
                                         password="TestPassword_123", role="client")
        service = Service.objects.create(client=owner, product_id=1, plan_id=2, provider_id=3,
            status="active", label="Unverified hosting", service_type="hosting",
            domain_name="example.test", provider_identifier="checkhost",
            billing_cycle="1mo", amount=Decimal("3000"), currency="NGN",
            next_due_date=timezone.now()+timedelta(days=30))
        api = APIClient()
        url = f"/api/services/opanel/{service.pk}/native-launch/"
        with patch("services.native_panel._session_request") as mint:
            for customer in (other, owner):
                api.force_authenticate(customer)
                response = api.post(url, {}, format="json")
                self.assertEqual(response.status_code, 403, response.data)
                self.assertIn("no-store", response["Cache-Control"])
            mint.assert_not_called()
