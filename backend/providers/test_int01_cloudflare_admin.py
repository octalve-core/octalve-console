"""Admin INT-01 only, DB-backed authentication + privacy gate."""
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from audit.models import AuditLog
from providers.cloudflare_int01 import CloudflareINT01Denied

class CloudflareAdminProbeTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        Users=get_user_model()
        cls.admin=Users.objects.create_user(
            email="cf-int01-admin@example.invalid",username="cf_int01_admin",
            password="test-only",role="admin",is_staff=True,is_superuser=True)
        cls.client=Users.objects.create_user(
            email="cf-int01-client@example.invalid",username="cf_int01_client",
            password="test-only",role="client")
        cls.spoof=Users.objects.create_user(
            email="cf-int01-spoof@example.invalid",username="cf_int01_spoof",
            password="test-only",role="admin",is_staff=False,is_superuser=False)

    def api(self,user=None):
        x=APIClient()
        if user:x.force_authenticate(user=user)
        return x

    def test_no_unauthenticated_or_role_only_user_can_read_probe(self):
        for user in (None,self.client,self.spoof):
            with self.subTest(user=user):
                reply=self.api(user).get("/api/providers/int01/cloudflare/probe/?scope=sandbox")
                self.assertIn(reply.status_code,(401,403))
                self.assertNotIn(b"account_id",reply.content)

    def test_disabled_by_default_and_unknown_scope_fail_without_external_call(self):
        api=self.api(self.admin)
        with patch.dict("os.environ",{"INT01_CLOUDFLARE_ADMIN_READBACK_ENABLED":"false"}),patch(
                "providers.cloudflare_int01_views.from_operator_environment") as upstream:
            reply=api.get("/api/providers/int01/cloudflare/probe/?scope=sandbox")
            self.assertEqual(reply.status_code,503)
            upstream.assert_not_called()
        with patch.dict("os.environ",{"INT01_CLOUDFLARE_ADMIN_READBACK_ENABLED":"true"}),patch(
                "providers.cloudflare_int01_views.from_operator_environment") as upstream:
            for q in ("scope=unknown","scope=dns&secret=abc","zone_id=bad"):
                with self.subTest(q=q):
                    self.assertEqual(api.get("/api/providers/int01/cloudflare/probe/?"+q).status_code,400)
            upstream.assert_not_called()

    def test_superadmin_sandbox_readback_records_audit_without_secrets(self):
        with patch.dict("os.environ",{"INT01_CLOUDFLARE_ADMIN_READBACK_ENABLED":"true"}),patch(
                "providers.cloudflare_int01_views.from_operator_environment") as source:
            source.return_value.sandbox_readback.return_value={
                "sandbox_authenticated":True,"sandbox_registration_count_page":0,
                "real_domain_created":False,"side_effects":False}
            reply=self.api(self.admin).get("/api/providers/int01/cloudflare/probe/?scope=sandbox")
        self.assertEqual(reply.status_code,200,reply.data)
        self.assertTrue(reply.data["verified"])
        self.assertFalse(reply.data["execution_enabled"])
        self.assertTrue(reply.data["sandbox_only"])
        self.assertIn("no-store",reply["Cache-Control"])
        source.assert_called_once_with("sandbox")
        rows=AuditLog.objects.filter(actor=self.admin,action="provider_connection_test")
        self.assertEqual(rows.count(),1)
        self.assertEqual(rows.first().details["scope"],"sandbox")
        self.assertNotIn("token",str(reply.data).lower())

    def test_failed_real_readback_never_reports_verified(self):
        with patch.dict("os.environ",{"INT01_CLOUDFLARE_ADMIN_READBACK_ENABLED":"true"}),patch(
                "providers.cloudflare_int01_views.from_operator_environment",side_effect=CloudflareINT01Denied):
            reply=self.api(self.admin).get("/api/providers/int01/cloudflare/probe/?scope=dns")
        self.assertEqual(reply.status_code,503)
        self.assertFalse(reply.data["verified"])
        self.assertEqual(AuditLog.objects.count(),0)
