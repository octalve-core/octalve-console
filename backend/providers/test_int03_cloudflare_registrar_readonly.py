"""INT-03 supplier domain-check and permission-bound quote acceptance.

All supplier responses are synthetic; NEVER calls live Cloudflare, pays, or
modifies a zone. Production cannot execute a registration from this module.
"""
import json
from unittest.mock import MagicMock,patch

from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.db import transaction
from django.test import TestCase,SimpleTestCase,override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from audit.models import AuditLog
from providers.cloudflare_int01 import (
    CloudflareINT01,CloudflareINT01Denied,FixedCloudflareTransport,
)
from providers.connection_audit import append_event
from providers.connection_models import IntegrationConnection,IntegrationCredentialVersion
from providers.connection_vault import seal

ACCOUNT="a"*32
DOMAIN="int03-quotation-example.com"
TOKEN="CI_ONLY_NO_CLOUDFLARE_SECRET_1234567890"
PASSWORD="CI_Only_Strong_Provider_Quote_Password_5678"
VAULT=Fernet.generate_key().decode()
STEPUP=Fernet.generate_key().decode()
AUDIT=Fernet.generate_key().decode()


def reply(result):
    return {"success":True,"errors":[],"result":result}


def available(domain=DOMAIN):
    return reply({"domains":[{"name":domain,"registrable":True,"tier":"standard",
        "pricing":{"currency":"USD","registration_cost":"8.57","renewal_cost":"9.09"}}]})


class LiveRegistrarTransportTests(SimpleTestCase):
    def test_one_fixed_live_check_and_no_purchase_operation(self):
        calls=[]
        def transport(method,path,body=None):
            calls.append((method,path,body))
            return available()
        result=CloudflareINT01(ACCOUNT,transport).live_domain_check(DOMAIN)
        self.assertTrue(result["registrable"])
        self.assertEqual(result["registration_cost"],"8.57")
        self.assertEqual(calls,[("POST",f"/accounts/{ACCOUNT}/registrar/domain-check",
                                 {"domains":[DOMAIN]})])

    def test_transport_never_accepts_real_registrar_purchase_dns_write_or_url_override(self):
        session=MagicMock()
        transport=FixedCloudflareTransport(TOKEN,session=session)
        for method,path,body in (
            ("POST",f"/accounts/{ACCOUNT}/registrar/registrations",{"domain_name":DOMAIN}),
            ("GET",f"/accounts/{ACCOUNT}/registrar/registrations",None),
            ("POST",f"/zones/{ACCOUNT}/dns_records",{"type":"A"}),
            ("PUT",f"/zones/{ACCOUNT}/dns_records",{"type":"A"}),
            ("DELETE",f"/zones/{ACCOUNT}/dns_records",None),
            ("POST","https://api.cloudflare.com/client/v4/accounts/x/registrar/domain-check",
             {"domains":[DOMAIN]}),
            ("GET",f"/accounts/{ACCOUNT}/registrar/domain-check",None),
            ("POST",f"/accounts/{ACCOUNT}/registrar/domain-check",
             {"domains":[DOMAIN],"register":True}),
            ("POST",f"/accounts/{ACCOUNT}/registrar/domain-check",
             {"domains":["127.0.0.1"]}),
            ("POST",f"/accounts/{ACCOUNT}/registrar/domain-check",
             {"domains":[DOMAIN,DOMAIN]}),
        ):
            with self.subTest(method=method,path=path),self.assertRaises(CloudflareINT01Denied):
                transport(method,path,body)
        session.request.assert_not_called()

    def test_valid_transport_is_fixed_origin_https_noredirects_bounded(self):
        session=MagicMock()
        response=MagicMock()
        response.status_code=200
        response.headers={"content-length":"200"}
        response.iter_content.return_value=[json.dumps(available()).encode()]
        response.__enter__.return_value=response
        session.request.return_value=response
        transport=FixedCloudflareTransport(TOKEN,session=session)
        quote=CloudflareINT01(ACCOUNT,transport).live_domain_check(DOMAIN)
        self.assertEqual(quote["currency"],"USD")
        args=session.request.call_args
        self.assertEqual(args.args[:2],("POST",f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/registrar/domain-check"))
        self.assertFalse(args.kwargs["allow_redirects"])
        self.assertTrue(args.kwargs["verify"])
        self.assertEqual(args.kwargs["timeout"],(3,8))
        self.assertFalse(session.trust_env)

    def test_unavailable_premium_price_tampering_and_cross_domain_fail_shut(self):
        for data in (
            {"domains":[]},
            {"domains":[{"name":"someone-else.com","registrable":True,"tier":"standard",
                         "pricing":{"currency":"USD","registration_cost":"8.57","renewal_cost":"9.09"}}]},
            {"domains":[{"name":DOMAIN,"registrable":True,"tier":"premium",
                         "pricing":{"currency":"USD","registration_cost":"8.57","renewal_cost":"9.09"}}]},
            {"domains":[{"name":DOMAIN,"registrable":True,"tier":"standard",
                         "pricing":{"currency":"USD","registration_cost":"NaN","renewal_cost":"9.09"}}]},
        ):
            with self.subTest(data=data),self.assertRaises(CloudflareINT01Denied):
                CloudflareINT01(ACCOUNT,lambda *_:reply(data)).live_domain_check(DOMAIN)
        result=CloudflareINT01(ACCOUNT,lambda *_:reply({"domains":[{
            "name":DOMAIN,"registrable":False,"reason":"domain_unavailable"
        }]})).live_domain_check(DOMAIN)
        self.assertFalse(result["registrable"])
        for unsafe in ("EXAMPLE.com","example.org","example.com.evil.test","https://example.com","localhost"):
            with self.assertRaises(CloudflareINT01Denied):
                CloudflareINT01(ACCOUNT,lambda *_:available()).live_domain_check(unsafe)


@override_settings(
    DEBUG=False,CLOUD_REGISTRAR_LIVE_QUOTE_READBACK_ENABLED=True,
    CLOUD_PROVIDER_CUSTODY_VERIFIED=True,
    CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED=True,
    CLOUD_PROVIDER_VAULT_KEY=VAULT,CLOUD_PROVIDER_STEPUP_KEY=STEPUP,
    CLOUD_PROVIDER_AUDIT_KEY=AUDIT,CLOUD_PROVIDER_VAULT_KEY_ID="v1",
)
class LiveRegistrarQuoteEndpointTests(TestCase):
    def setUp(self):
        Users=get_user_model()
        self.admin=Users.objects.create_superuser(
            email="int03-owner@example.invalid",username="int03_owner",
            email_verified_at=timezone.now(),password=PASSWORD)
        self.staff=Users.objects.create_user(
            email="int03-staff@example.invalid",username="int03_staff",
            role="staff",is_staff=True,password=PASSWORD)
        self.client=APIClient()
        self.client.force_authenticate(user=self.admin)
        self.row=IntegrationConnection.objects.create(
            adapter_key="cloudflare-registrar-live",label="Quote-only",
            environment="test",public_settings={"account_id":ACCOUNT},
            state="draft",current_version=1,created_by=self.admin)
        IntegrationCredentialVersion.objects.create(
            connection=self.row,version=1,key_id="v1",
            ciphertext=seal(self.row.adapter_key,self.row.pk,1,{"api_token":TOKEN}))
        with transaction.atomic():
            locked=IntegrationConnection.objects.select_for_update().get(pk=self.row.pk)
            append_event(locked,self.admin,"draft_created",1)
        self.path=f"/api/providers/connections/{self.row.pk}/registrar-quote/"
        self.body={"domain":DOMAIN,"confirm_password":PASSWORD,"totp_code":"123456"}

    def test_quote_requires_independent_gate_valid_superadmin_and_stepup(self):
        for override in (
            {"CLOUD_REGISTRAR_LIVE_QUOTE_READBACK_ENABLED":False},
            {"CLOUD_PROVIDER_CUSTODY_VERIFIED":False},
            {"CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED":False},
            {"DEBUG":True},
        ):
            with self.subTest(override=override),override_settings(**override),patch(
                "providers.connection_registrar_views.CloudflareINT01") as external:
                response=self.client.post(self.path,self.body,format="json")
                self.assertEqual(response.status_code,503,response.data)
                external.assert_not_called()
        for user in (None,self.staff):
            client=APIClient()
            if user:client.force_authenticate(user=user)
            with patch("providers.connection_registrar_views.CloudflareINT01") as external:
                response=client.post(self.path,self.body,format="json")
                self.assertIn(response.status_code,(401,403),response.data)
                external.assert_not_called()

    def test_unenrolled_mfa_is_denied_without_supplier_request(self):
        with patch("providers.connection_registrar_views.connection_database_qualified",return_value=True),patch(
            "providers.connection_registrar_views.CloudflareINT01") as external:
            response=self.client.post(self.path,self.body,format="json")
        self.assertEqual(response.status_code,403,response.data)
        external.assert_not_called()

    def test_approved_request_reports_supplier_price_only_and_audits(self):
        with patch("providers.connection_registrar_views.connection_database_qualified",return_value=True),patch(
            "providers.connection_registrar_views.check_mutation",return_value=None) as mfa,patch(
            "providers.connection_registrar_views.CloudflareINT01") as provider:
            provider.return_value.live_domain_check.return_value={
                "name":DOMAIN,"registrable":True,"tier":"standard",
                "currency":"USD","registration_cost":"8.57","renewal_cost":"9.09"
            }
            result=self.client.post(self.path,self.body,format="json")
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(result.data["domain"],DOMAIN)
        self.assertFalse(result.data["checkout_enabled"])
        self.assertFalse(result.data["registration_enabled"])
        self.assertFalse(result.data["execution_enabled"])
        self.assertTrue(result.data["supplier_price_only"])
        self.assertIn("no-store",result["Cache-Control"])
        self.assertNotIn(TOKEN,json.dumps(result.data))
        mfa.assert_called_once()
        provider.assert_called_once()
        provider.return_value.live_domain_check.assert_called_once_with(DOMAIN)
        self.assertEqual(IntegrationConnection.objects.count(),1)
        self.assertEqual(IntegrationCredentialVersion.objects.count(),1)
        receipt=AuditLog.objects.get(action="provider_connection_test")
        self.assertEqual(receipt.details["operation"],"registrar.domain-check")
        self.assertNotIn("api_token",json.dumps(receipt.details))
        self.assertNotIn(TOKEN,json.dumps(receipt.details))

    def test_deny_wrong_adapter_revoked_secret_and_supplier_failure(self):
        with patch("providers.connection_registrar_views.connection_database_qualified",return_value=True),patch(
            "providers.connection_registrar_views.check_mutation",return_value=None),patch(
            "providers.connection_registrar_views.CloudflareINT01") as provider:
            provider.return_value.live_domain_check.side_effect=CloudflareINT01Denied()
            rejected=self.client.post(self.path,self.body,format="json")
            self.assertEqual(rejected.status_code,503)
            self.assertFalse(AuditLog.objects.filter(action="provider_connection_test").exists())
            self.row.adapter_key="cloudflare-dns"
            self.row.save(update_fields=["adapter_key"])
            denied=self.client.post(self.path,self.body,format="json")
            self.assertEqual(denied.status_code,404)
        self.assertFalse(AuditLog.objects.filter(action="provider_connection_test").exists())
        self.assertNotIn(TOKEN,str(rejected.data))

    def test_unexpected_payload_cannot_reach_provider(self):
        with patch("providers.connection_registrar_views.CloudflareINT01") as outbound:
            for body in (
                dict(self.body,register=True),
                dict(self.body,domain="int03-quotation-example.org"),
                {"domain":DOMAIN},
            ):
                with self.subTest(body=body):
                    result=self.client.post(self.path,body,format="json")
                    self.assertIn(result.status_code,(400,503),result.data)
            outbound.assert_not_called()
