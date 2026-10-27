"""B1 isolated credential lifecycle: no vendor calls; no Production secrets."""
import base64
import json
from unittest.mock import patch
from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase
from audit.models import AuditLog
from providers.connection_models import IntegrationConnection, IntegrationCredentialVersion, IntegrationConnectionEvent
from providers.connection_vault import inspect_test_only
from providers.connection_models import ProviderVaultAuthenticator
from providers.connection_stepup import otp_at

KEY=Fernet.generate_key().decode()
AUTH_KEY=Fernet.generate_key().decode()
AUTH_SECRET='JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
PASSWORD="ci-only-password-test-0123!"

@override_settings(CLOUD_PROVIDER_VAULT_KEY=KEY,CLOUD_PROVIDER_VAULT_KEY_ID="v1",
                   CLOUD_PROVIDER_STEPUP_KEY=AUTH_KEY, CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED=True,
                   CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=True)
class DraftVaultTests(APITestCase):
    def setUp(self):
        cache.clear()  # Each test gets an isolated throttle budget.
        User=get_user_model()
        self.owner=User.objects.create_superuser(email="vault-admin@example.invalid",username="vaultadmin",password=PASSWORD)
        self.other=User.objects.create_user(email="vault-client@example.invalid",username="vaultclient",password=PASSWORD)
        self.client.force_authenticate(user=self.owner)
        ProviderVaultAuthenticator.objects.create(user=self.owner,verified=True,
             encrypted_secret=Fernet(AUTH_KEY.encode()).encrypt(AUTH_SECRET.encode()).decode(),
             last_counter=-1)
        self.test_clock=1800000000
        self.clock_patch=patch("providers.connection_stepup.time.time",side_effect=lambda:self.test_clock)
        self.clock_patch.start()
        self.addCleanup(self.clock_patch.stop)
        original_post=self.client.post
        self.original_post=original_post
        def stepup_post(path,data=None,*args,**kwargs):
            if path.startswith("/api/providers/connections/"):
                self.test_clock+=30
                data=dict(data or {})
                data["totp_code"]=otp_at(AUTH_SECRET,self.test_clock//30)
            return original_post(path,data,*args,**kwargs)
        self.client.post=stepup_post
        self.payload={"adapter_key":"directadmin","label":"Test Panel A","environment":"test",
                      "public_settings":{"server_url":"https://panel.example.invalid:2222","username":"reseller"},
                      "secrets":{"login_key":"TEST-SYNTHETIC-API-KEY-123"},"confirm_password":PASSWORD}
        self.allowed=patch.dict("os.environ",{"CLOUD_CONNECTION_ALLOWED_HOSTS":"panel.example.invalid"})
        self.allowed.start()
        self.addCleanup(self.allowed.stop)

    def test_draft_stores_ciphertext_and_never_reads_secret_back(self):
        response=self.client.post("/api/providers/connections/",self.payload,format="json")
        self.assertEqual(response.status_code,201,response.data)
        self.assertEqual(response.data["state"],"draft")
        self.assertFalse(response.data["execution_enabled"])
        row=IntegrationConnection.objects.get()
        version=IntegrationCredentialVersion.objects.get(connection=row)
        self.assertNotIn("TEST-SYNTHETIC-API-KEY-123",version.ciphertext)
        self.assertEqual(inspect_test_only(version.ciphertext,row.adapter_key,row.pk,1),self.payload["secrets"])
        for url in ["/api/providers/connections/","/api/providers/connections/%s/"%row.pk,"/api/providers/connections/schemas/"]:
            get=self.client.get(url)
            self.assertEqual(get.status_code,200,get.data)
            self.assertNotIn("TEST-SYNTHETIC-API-KEY-123",json.dumps(get.data))
            self.assertNotIn("ciphertext",json.dumps(get.data))
        self.assertEqual(IntegrationConnectionEvent.objects.filter(connection=row,action="draft_created").count(),1)
        self.assertFalse(AuditLog.objects.filter(entity_type__in=[
            "IntegrationConnection","IntegrationCredentialVersion","IntegrationConnectionEvent"
        ]).exists(), "Do not mirror vault records into generic audit JSON.")


    def test_rotation_and_revocation_are_atomic_and_inert(self):
        created=self.client.post("/api/providers/connections/",self.payload,format="json")
        uid=created.data["id"]
        row=IntegrationConnection.objects.get(pk=uid)
        result=self.client.post(f"/api/providers/connections/{uid}/rotate/",
                                {"secrets":{"login_key":"TEST-ROTATED-KEY-000001"},"confirm_password":PASSWORD},format="json")
        self.assertEqual(result.status_code,200,result.data)
        self.assertEqual(result.data["credential_version"],2)
        self.assertIsNotNone(IntegrationCredentialVersion.objects.get(connection=row,version=1).revoked_at)
        self.assertIsNone(IntegrationCredentialVersion.objects.get(connection=row,version=2).revoked_at)
        revoked=self.client.post(f"/api/providers/connections/{uid}/revoke/",{"confirm_password":PASSWORD},format="json")
        self.assertEqual(revoked.status_code,200,revoked.data)
        self.assertEqual(revoked.data["state"],"revoked")
        self.assertFalse(revoked.data["credential_configured"])
        self.assertEqual(IntegrationConnectionEvent.objects.filter(connection=row).count(),3)
        self.assertEqual(self.client.post(f"/api/providers/connections/{uid}/rotate/",
                            {"secrets":{"login_key":"TEST-ROTATED-KEY-000002"},"confirm_password":PASSWORD},
                            format="json").status_code,409)
        self.assertEqual(IntegrationCredentialVersion.objects.filter(connection=row).count(),2)

    def test_no_storage_when_flag_off_or_vault_key_invalid_or_password_wrong(self):
        with override_settings(CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=False):
            self.assertEqual(self.client.post("/api/providers/connections/",self.payload,format="json").status_code,503)
        with override_settings(CLOUD_PROVIDER_VAULT_KEY=""):
            self.assertEqual(self.client.post("/api/providers/connections/",self.payload,format="json").status_code,503)
        bad=dict(self.payload,confirm_password="wrong")
        self.assertEqual(self.client.post("/api/providers/connections/",bad,format="json").status_code,403)
        self.assertEqual(IntegrationConnection.objects.count(),0)

    def test_non_admin_and_non_superuser_cannot_modify_connections(self):
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get("/api/providers/connections/").status_code,403)
        self.assertEqual(self.client.post("/api/providers/connections/",self.payload,format="json").status_code,403)
        staff=get_user_model().objects.create_user(email="vault-staff@example.invalid",
                                                    username="vaultstaff",password=PASSWORD,role="admin")
        self.client.force_authenticate(user=staff)
        self.assertEqual(self.client.post("/api/providers/connections/",self.payload,format="json").status_code,403)
        self.assertEqual(IntegrationConnection.objects.count(),0)

    def test_unknown_fields_unsafe_host_and_bad_secret_refused(self):
        for data in [
            dict(self.payload,public_settings={"server_url":"http://panel.example.invalid:2222","username":"reseller"}),
            dict(self.payload,public_settings={"server_url":"https://127.0.0.1:2222","username":"reseller"}),
            dict(self.payload,public_settings={"server_url":"https://metadata.google.internal:2222","username":"reseller"}),
            dict(self.payload,public_settings={"server_url":"https://panel.example.invalid:8080","username":"reseller"}),
            dict(self.payload,secrets={"login_key":"too-short"}),
            dict(self.payload,config={"secret":"MUST_NOT_STORE"}),
            dict(self.payload,adapter_key="custom-provider"),
        ]:
            with self.subTest(data=data):
                self.assertIn(self.client.post("/api/providers/connections/",data,format="json").status_code,(400,403))
        self.assertFalse(IntegrationConnection.objects.exists())

    def test_event_audit_contains_no_credentials(self):
        self.client.post("/api/providers/connections/",self.payload,format="json")
        event=IntegrationConnectionEvent.objects.get()
        self.assertEqual(event.action,"draft_created")
        self.assertNotIn("TEST-SYNTHETIC-API-KEY-123",str(event.__dict__))

    def test_registry_missing_tables_fails_with_service_unavailable(self):
        from django.db.utils import OperationalError
        with patch("providers.connection_views.IntegrationConnection.objects.order_by",
                   side_effect=OperationalError("missing test table")):
            result=self.client.get("/api/providers/connections/")
        self.assertEqual(result.status_code,503)
        self.assertNotIn("test table",str(result.data))

    def test_wrong_encryption_key_does_not_fall_back_to_legacy(self):
        with override_settings(CLOUD_PROVIDER_VAULT_KEY="bad-base64"):
            self.assertEqual(self.client.post("/api/providers/connections/",self.payload,format="json").status_code,503)
        self.assertFalse(IntegrationConnection.objects.exists())
