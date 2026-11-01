"""INT-02: portable encrypted Console submissions, role/crypto/migration gates."""
import json
from unittest.mock import patch
from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.test import override_settings,TestCase
from rest_framework.test import APIClient

from providers.connection_models import IntegrationConnection,IntegrationCredentialVersion

KEY=Fernet.generate_key().decode()
STEP=Fernet.generate_key().decode()
AUDIT=Fernet.generate_key().decode()
PASSWORD="CI-restricted-account-password"

@override_settings(
 DEBUG=False,CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=True,
 CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED=True,CLOUD_PROVIDER_CUSTODY_VERIFIED=True,
 CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED=True,
 CLOUD_PROVIDER_VAULT_KEY=KEY,CLOUD_PROVIDER_VAULT_KEY_ID="int02",
 CLOUD_PROVIDER_AUDIT_KEY=AUDIT,CLOUD_PROVIDER_STEPUP_KEY=STEP,
 CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON="")
class SecureConsoleCredentialTests(TestCase):
 def setUp(self):
  U=get_user_model()
  self.admin=U.objects.create_superuser(email="int02-super@example.invalid",username="int02_super",password=PASSWORD)
  self.spoof=U.objects.create_user(email="int02-unsafe@example.invalid",username="int02_unsafe",password=PASSWORD,role="admin",is_staff=False)
  self.staff=U.objects.create_user(email="int02-staff@example.invalid",username="int02_staff",password=PASSWORD,role="staff",is_staff=True)
  self.client=U.objects.create_user(email="int02-client@example.invalid",username="int02_client",password=PASSWORD)
  self.c=APIClient()
  self.c.force_authenticate(user=self.admin)
  self.payload={
   "adapter_key":"cloudflare-dns","label":"Octalve test DNS","environment":"test",
   "public_settings":{"account_id":"a"*32,"zone_id":"b"*32},
   "secrets":{"api_token":"CI-test-provider-token-that-is-not-real"},
   "confirm_password":PASSWORD,"totp_code":"123456"
  }

 def test_no_user_can_self_promote_through_vault(self):
  for user in (None,self.spoof,self.staff,self.client):
   c=APIClient()
   if user:c.force_authenticate(user=user)
   with self.subTest(user=user):
    res=c.post("/api/providers/connections/",self.payload,format="json")
    self.assertIn(res.status_code,(401,403))
  self.assertEqual(IntegrationConnection.objects.count(),0)

 def test_production_storage_is_denied_until_custody_db_and_mfa(self):
  for setting,value in (("CLOUD_PROVIDER_CUSTODY_VERIFIED",False),
                        ("CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED",False),
                        ("CLOUD_PROVIDER_VAULT_KEY","")):
   with override_settings(**{setting:value}),patch("providers.connection_views.connection_database_qualified",return_value=True):
    self.assertEqual(self.c.post("/api/providers/connections/",self.payload,format="json").status_code,503)
  with patch("providers.connection_views.connection_database_qualified",return_value=False):
   self.assertEqual(self.c.post("/api/providers/connections/",self.payload,format="json").status_code,503)
  with patch("providers.connection_views.connection_database_qualified",return_value=True):
   self.assertEqual(self.c.post("/api/providers/connections/",self.payload,format="json").status_code,403)
  self.assertEqual(IntegrationConnection.objects.count(),0)

 def test_production_under_vercel_can_only_store_ciphertext_and_never_execute(self):
  with patch.dict("os.environ",{"VERCEL":"1","VERCEL_ENV":"production"}),patch(
     "providers.connection_views.connection_database_qualified",return_value=True),patch(
     "providers.connection_views.check_mutation",return_value=None) as step:
   res=self.c.post("/api/providers/connections/",self.payload,format="json")
  self.assertEqual(res.status_code,201,res.data)
  step.assert_called_once()
  self.assertFalse(res.data["execution_enabled"])
  self.assertNotIn("CI-test-provider-token",json.dumps(res.data))
  row=IntegrationConnection.objects.get()
  sealed=IntegrationCredentialVersion.objects.get(connection=row)
  self.assertNotIn(self.payload["secrets"]["api_token"],sealed.ciphertext)
  self.assertEqual(row.state,"draft")
  self.assertEqual(row.audit_sequence,1)

 def test_verification_from_encrypted_secret_is_read_only(self):
  with patch("providers.connection_views.connection_database_qualified",return_value=True),patch(
      "providers.connection_views.check_mutation",return_value=None):
   created=self.c.post("/api/providers/connections/",self.payload,format="json")
  self.assertEqual(created.status_code,201,created.data)
  with patch("providers.connection_verification.connection_database_qualified",return_value=True),patch(
      "providers.connection_verification.check_mutation",return_value=None),patch(
      "providers.connection_verification.FixedCloudflareTransport") as transport:
   connector=__import__("providers.cloudflare_int01",fromlist=["CloudflareINT01"]).CloudflareINT01
   with patch("providers.connection_verification.CloudflareINT01") as C:
    C.return_value.dns_readback.return_value={
      "zone_id":"b"*32,"zone_verified":True,"dns_record_count":2,
      "record_digest_sha256":"c"*64,"side_effects":False}
    receipt=self.c.post("/api/providers/connections/"+created.data["id"]+"/verify/",
       {"confirm_password":PASSWORD,"totp_code":"123456"},format="json")
  self.assertEqual(receipt.status_code,200,receipt.data)
  self.assertTrue(receipt.data["verified"])
  self.assertFalse(receipt.data["execution_enabled"])
  self.assertNotIn("CI-test-provider-token",json.dumps(receipt.data))
  transport.assert_called_once_with(self.payload["secrets"]["api_token"])

 def test_unknown_adapter_has_no_generic_verifier(self):
  with patch("providers.connection_verification.connection_database_qualified",return_value=True),patch(
      "providers.connection_verification.check_mutation",return_value=None):
   response=self.c.post("/api/providers/connections/00000000-0000-0000-0000-000000000001/verify/",
     {"confirm_password":PASSWORD,"totp_code":"123456"},format="json")
  self.assertEqual(response.status_code,404)
