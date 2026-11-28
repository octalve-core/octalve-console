"""INT-02: portable encrypted Console submissions, role/crypto/migration gates."""
import json
from unittest.mock import patch
from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.test import override_settings,TestCase
from django.utils import timezone
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
 CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON="",
 CLOUD_PROVIDER_ALLOWED_DRAFT_ADAPTERS="cloudflare-dns")
class SecureConsoleCredentialTests(TestCase):
 def setUp(self):
  U=get_user_model()
  self.admin=U.objects.create_superuser(email="int02-super@example.invalid",username="int02_super",password=PASSWORD,
        email_verified_at=timezone.now())
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

 def test_credential_intake_uses_schema_even_with_old_allowlist(self):
  with patch("providers.connection_views.connection_database_qualified",return_value=True),patch(
      "providers.connection_views.check_mutation",return_value=None),override_settings(
      CLOUD_PROVIDER_ALLOWED_DRAFT_ADAPTERS="cloudflare-dns"):
   payload={**self.payload,"adapter_key":"paystack","public_settings":{},
            "secrets":{"secret_key":"sk_test_0123456789abcdef"}}
   saved=self.c.post("/api/providers/connections/",payload,format="json")
   self.assertEqual(saved.status_code,201,saved.data)
   self.assertNotIn("sk_test_0123456789abcdef",json.dumps(saved.data))
   denied=self.c.post("/api/providers/connections/",{**payload,"adapter_key":"unknown"},format="json")
   self.assertEqual(denied.status_code,400,denied.data)

 def test_stepup_can_be_enrolled_before_provider_writes(self):
  from providers.connection_stepup import otp_at
  from unittest.mock import patch
  with override_settings(CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=False),patch(
      "providers.connection_stepup.time.time",return_value=1800000000):
   status=self.c.get("/api/providers/security/stepup/")
   self.assertEqual(status.status_code,200,status.data)
   self.assertTrue(status.data["enrollment_available"])
   self.assertFalse(status.data["credential_submission_available"])
   enrolled=self.c.post("/api/providers/security/stepup/enroll/",{"confirm_password":PASSWORD},format="json")
   self.assertEqual(enrolled.status_code,200,enrolled.data)
   confirmed=self.c.post("/api/providers/security/stepup/confirm/",{
       "confirm_password":PASSWORD,"totp_code":otp_at(enrolled.data["secret"],1800000000//30)},format="json")
   self.assertEqual(confirmed.status_code,200,confirmed.data)
   self.assertTrue(confirmed.data["verified"])
   self.assertFalse(self.c.get("/api/providers/security/stepup/").data["credential_submission_available"])
  self.assertFalse(IntegrationConnection.objects.exists())

 def test_credential_status_requires_totp(self):
  with patch("providers.connection_security_views.connection_database_qualified",return_value=True):
   status=self.c.get("/api/providers/security/stepup/")
   self.assertFalse(status.data["credential_submission_available"])
   self.assertEqual(status.data["approved_draft_adapters"],[])
   with override_settings(CLOUD_PROVIDER_ALLOWED_DRAFT_ADAPTERS="not-registered"):
    invalid=self.c.get("/api/providers/security/stepup/")
    self.assertFalse(invalid.data["credential_submission_available"])
  self.assertFalse(IntegrationConnection.objects.exists())

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


 def test_hosting_verification_imports_inert_inventory_without_copying_key(self):
  from providers.models import Provider,ProviderPackage
  from audit.models import AuditLog
  secret="fixture-only-hosting-token-012345"
  for adapter,port,key in (("directadmin",2222,"login_key"),("cpanel-whm",2087,"api_token")):
   with self.subTest(adapter=adapter),patch.dict("os.environ",{"CLOUD_CONNECTION_ALLOWED_HOSTS":"panel.example.invalid"}),patch(
       "providers.connection_views.connection_database_qualified",return_value=True),patch(
       "providers.connection_views.check_mutation",return_value=None):
    payload={**self.payload,"adapter_key":adapter,"label":adapter,"environment":"test",
       "public_settings":{"server_url":f"https://panel.example.invalid:{port}","username":"reseller"},
       "secrets":{key:secret}}
    saved=self.c.post("/api/providers/connections/",payload,format="json")
    self.assertEqual(saved.status_code,201,saved.data)
    endpoint="/api/providers/connections/"+saved.data["id"]+"/verify/"
    with patch("providers.connection_verification.connection_database_qualified",return_value=True),patch(
        "providers.connection_verification.check_mutation",return_value=None),patch(
        "providers.hosting_inventory.fetch_inventory",return_value=[
            {"provider_package_id":"starter","name":"starter","specs":{"quota":"1024"}},
            {"provider_package_id":"business","name":"business","specs":{"quota":"2048"}}]) as fetch:
     body={"confirm_password":PASSWORD,"totp_code":"123456"}
     result=self.c.post(endpoint,body,format="json")
     self.assertEqual(result.status_code,200,result.data)
     self.assertEqual(result.data["evidence"]["package_count"],2)
     self.assertFalse(result.data["execution_enabled"])
     self.assertNotIn(secret,json.dumps(result.data))
     self.assertEqual(fetch.call_args.args[0].get_api_key(),secret)
     provider=Provider.objects.get(pk=result.data["evidence"]["provider_id"])
     self.assertEqual(provider.status,"inactive")
     self.assertTrue(provider.test_mode)
     self.assertFalse(provider.encrypted_api_key)
     self.assertFalse(provider.encrypted_secret)
     self.assertFalse(ProviderPackage.objects.filter(provider=provider,is_active=True).exists())
     self.assertEqual(ProviderPackage.objects.filter(provider=provider).count(),2)
     fetch.return_value=[{"provider_package_id":"starter","name":"starter","specs":{"quota":"512"}}]
     result=self.c.post(endpoint,body,format="json")
     self.assertEqual(result.status_code,200,result.data)
     self.assertEqual(Provider.objects.filter(pk=provider.pk).count(),1)
     self.assertEqual(ProviderPackage.objects.get(provider=provider,provider_package_id="starter").specs,{"quota":"512"})
     self.assertFalse(ProviderPackage.objects.get(provider=provider,provider_package_id="business").raw_data["available"])
     self.assertTrue(AuditLog.objects.filter(entity_id=saved.data["id"],action="provider_connection_test",
         details__execution_enabled=False).exists())

 def test_hosting_inventory_rejects_changed_credential_during_readback(self):
  from providers.models import Provider
  from providers.hosting_inventory import stage_inventory
  from providers.inventory import InventoryError
  with patch.dict("os.environ",{"CLOUD_CONNECTION_ALLOWED_HOSTS":"panel.example.invalid"}),patch(
      "providers.connection_views.connection_database_qualified",return_value=True),patch(
      "providers.connection_views.check_mutation",return_value=None):
   saved=self.c.post("/api/providers/connections/",{**self.payload,"adapter_key":"directadmin",
      "public_settings":{"server_url":"https://panel.example.invalid:2222","username":"reseller"},
      "secrets":{"login_key":"fixture-only-hosting-token-012345"}},format="json")
  self.assertEqual(saved.status_code,201,saved.data)
  snapshot=IntegrationConnection.objects.get(pk=saved.data["id"])
  IntegrationConnection.objects.filter(pk=snapshot.pk).update(current_version=2)
  with self.assertRaises(InventoryError):
   stage_inventory(snapshot,[{"provider_package_id":"starter","name":"starter","specs":{"quota":"1024"}}],self.admin)
  self.assertFalse(Provider.objects.exists())


 @override_settings(CLOUD_HOSTING_CONFIGURED_EGRESS_ENABLED=True)
 def test_configured_hosting_credentials_are_bound_to_the_exact_network_destination(self):
  from providers.connection_vault import unseal_version,VaultUnavailable
  from providers.connection_models import IntegrationCredentialVersion
  secret="fixture-only-hosting-token-012345"
  public={"server_url":"https://panel.example.invalid:2087","username":"reseller","server_ip":"8.8.8.8"}
  with patch.dict("os.environ",{"CLOUD_CONNECTION_ALLOWED_HOSTS":""}),patch(
      "providers.connection_views.connection_database_qualified",return_value=True),patch(
      "providers.connection_views.check_mutation",return_value=None):
   saved=self.c.post("/api/providers/connections/",{**self.payload,"adapter_key":"cpanel-whm",
      "public_settings":public,"secrets":{"api_token":secret}},format="json")
  self.assertEqual(saved.status_code,201,saved.data)
  connection=IntegrationConnection.objects.get(pk=saved.data["id"])
  def decrypt():
   version=IntegrationCredentialVersion.objects.select_related("connection").get(connection=connection,version=1)
   return unseal_version(version)
  self.assertEqual(decrypt(),{"api_token":secret})
  for changed in ({**public,"server_ip":"1.1.1.1"},{**public,"server_url":"https://other.example.invalid:2087"},
                  {**public,"username":"other"},{"server_url":public["server_url"],"username":"reseller"}):
   IntegrationConnection.objects.filter(pk=connection.pk).update(public_settings=changed)
   with self.assertRaises(VaultUnavailable):
    decrypt()
  IntegrationConnection.objects.filter(pk=connection.pk).update(public_settings=public,environment="live")
  with patch("providers.connection_views.connection_database_qualified",return_value=True),patch(
      "providers.connection_views.check_mutation",return_value=None):
   denied=self.c.post("/api/providers/connections/"+saved.data["id"]+"/rotate/",
       {"secrets":{"api_token":"new-fixture-token-012345"},"confirm_password":PASSWORD,"totp_code":"123456"},format="json")
  self.assertEqual(denied.status_code,503)
  self.assertEqual(IntegrationCredentialVersion.objects.filter(connection=connection).count(),1)
  # The fixture is a test connection; environment cannot be edited in the database.
  if self.payload["environment"]=="test":
   with self.assertRaises(VaultUnavailable):
    decrypt()


 @override_settings(CLOUD_HOSTING_VENDOR_CREATE_ENABLED=True,
    CLOUD_HOSTING_CONFIGURED_EGRESS_ENABLED=True,CLOUD_SUPPLIER_PINNED_READBACK_ENABLED=True)
 def test_hosting_policy_requires_exact_current_credential_and_mfa(self):
  from providers.models import Provider
  from providers.hosting_runtime import load_hosting_connection,POLICY
  from providers.connection_vault import VaultUnavailable
  payload={**self.payload,"adapter_key":"cpanel-whm","environment":"live",
      "public_settings":{"server_url":"https://panel.example.invalid:2087","username":"reseller","server_ip":"8.8.8.8"},
      "secrets":{"api_token":"fixture-only-hosting-token-012345"}}
  inventory=[{"provider_package_id":"starter","name":"Starter","specs":{"quota":"1024"}}]
  with patch("providers.connection_views.connection_database_qualified",return_value=True),patch(
      "providers.connection_views.check_mutation",return_value=None),patch(
      "providers.connection_verification.connection_database_qualified",return_value=True),patch(
      "providers.connection_verification.check_mutation",return_value=None),patch(
      "providers.hosting_runtime.connection_database_qualified",return_value=True),patch(
      "providers.hosting_inventory.fetch_inventory",return_value=inventory):
   saved=self.c.post("/api/providers/connections/",payload,format="json")
   self.assertEqual(saved.status_code,201,saved.data)
   root="/api/providers/connections/"+saved.data["id"]+"/"
   auth={"confirm_password":PASSWORD,"totp_code":"123456"}
   verified=self.c.post(root+"verify/",auth,format="json")
   self.assertEqual(verified.status_code,200,verified.data)
   provider=Provider.objects.get(pk=verified.data["evidence"]["provider_id"])
   self.assertEqual(provider.status,"inactive")
   with self.assertRaises(VaultUnavailable):
    load_hosting_connection(provider)
   body={**auth,"fulfillment_model":"owned_server","shared_ip":None,"accept":True}
   foreign=APIClient();foreign.force_authenticate(self.client)
   self.assertEqual(foreign.post(root+"hosting-policy/",body,format="json").status_code,403)
   denied=self.c.post(root+"hosting-policy/",{**body,"accept":False},format="json")
   self.assertEqual(denied.status_code,400,denied.data)
   approved=self.c.post(root+"hosting-policy/",body,format="json")
   self.assertEqual(approved.status_code,200,approved.data)
   provider.refresh_from_db()
   self.assertEqual(provider.status,"active")
   self.assertEqual(load_hosting_connection(provider)[0].current_version,1)
   self.assertNotIn(payload["secrets"]["api_token"],json.dumps(approved.data))
   original=provider.config.copy()
   provider.config={**original,"fulfillment_model":"partner_reseller"}
   with self.assertRaises(VaultUnavailable):
    load_hosting_connection(provider)
   provider.config=original
   rotated=self.c.post(root+"rotate/",{**auth,"secrets":{"api_token":"rotated-hosting-fixture-012345"}},format="json")
   self.assertEqual(rotated.status_code,200,rotated.data)
   provider.refresh_from_db()
   self.assertEqual(provider.status,"inactive")
   with self.assertRaises(VaultUnavailable):
    load_hosting_connection(provider)

 def test_generic_readback_rejects_connection_changed_during_network(self):
  from audit.models import AuditLog
  with patch("providers.connection_views.connection_database_qualified",return_value=True),patch(
      "providers.connection_views.check_mutation",return_value=None):
   saved=self.c.post("/api/providers/connections/",{**self.payload,"adapter_key":"paystack",
       "public_settings":{},"secrets":{"secret_key":"sk_test_fixture_only_0123456789"}},format="json")
  self.assertEqual(saved.status_code,201,saved.data)
  def changed(*args,**kwargs):
   IntegrationConnection.objects.filter(pk=saved.data["id"]).update(state="revoked")
   return {"authenticated":True,"read_only":True}
  with patch("providers.connection_verification.connection_database_qualified",return_value=True),patch(
      "providers.connection_verification.check_mutation",return_value=None),patch(
      "providers.connection_verification.paystack_readback",side_effect=changed):
   result=self.c.post("/api/providers/connections/"+saved.data["id"]+"/verify/",
       {"confirm_password":PASSWORD,"totp_code":"123456"},format="json")
  self.assertEqual(result.status_code,503,result.data)
  self.assertFalse(AuditLog.objects.filter(action="provider_connection_test",entity_id=saved.data["id"]).exists())
