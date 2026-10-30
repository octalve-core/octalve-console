"""SET-02/03: enforce tax and theme boundaries in isolated ORM tests."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

class ConsolePolicyBoundaries(TestCase):
 def setUp(self):
  U=get_user_model()
  self.admin=U.objects.create_superuser(email="policy-owner@example.invalid",username="policy_owner",password="Unused-test-only!")
  self.customer=U.objects.create_user(email="policy-client@example.invalid",username="policy_client",password="Unused-test-only!")
  self.api=APIClient()
 def test_tax_is_private_and_checkout_unconnected(self):
  self.api.force_authenticate(user=self.customer)
  self.assertEqual(self.api.get("/api/settings/console-tax/").status_code,403)
  self.assertEqual(self.api.patch("/api/settings/console-tax/",{},format="json").status_code,403)
  self.api.force_authenticate(user=self.admin)
  from settings_registry.models import TaxSettings,TaxPolicyRevision
  before_count=TaxSettings.objects.count()
  response=self.api.get("/api/settings/console-tax/")
  self.assertEqual(TaxSettings.objects.count(),before_count,"Reading policy must not initialize a row")
  self.assertEqual(response.status_code,200,response.data)
  self.assertFalse(response.data["checkout_active"])
  revision=response.data["revision"]
  bad=self.api.patch("/api/settings/console-tax/",{"revision":revision,
      "changes":{"default_tax_rate":"100.00"}},format="json")
  self.assertEqual(bad.status_code,400)
  bad=self.api.patch("/api/settings/console-tax/",{"revision":revision,
      "changes":{"is_superuser":True}},format="json")
  self.assertEqual(bad.status_code,400)
  saved=self.api.patch("/api/settings/console-tax/",{"revision":revision,
      "changes":{"vat_number":"REG-2026","default_tax_rate":"7.50"}},format="json")
  self.assertEqual(saved.status_code,200,saved.data)
  self.assertIsNotNone(saved.data.get("audit_id"))
  self.assertEqual(saved.data.get("tax_revision"),1)
  self.assertEqual(TaxPolicyRevision.objects.filter(policy_id=1).count(),1)
  history=self.api.get("/api/settings/console-tax/history/")
  self.assertEqual(history.status_code,200,history.data)
  self.assertEqual(history.data["revisions"][0]["snapshot"]["default_tax_rate"],"7.50")
  self.api.force_authenticate(user=self.customer)
  self.assertEqual(self.api.get("/api/settings/console-tax/history/").status_code,403)
  self.api.force_authenticate(user=self.admin)
  self.assertFalse(saved.data["checkout_active"])
  stale=self.api.patch("/api/settings/console-tax/",{"revision":revision,
      "changes":{"enable_tax":False}},format="json")
  self.assertEqual(stale.status_code,409)
 def test_theme_public_endpoint_does_not_return_settings_or_secrets(self):
  self.api.force_authenticate(user=None)
  response=self.api.get("/api/settings/console-theme/")
  self.assertEqual(response.status_code,200,response.data)
  self.assertEqual(set(response.data),{"primary_color","canvas_color","density"})
  self.assertNotIn("support_email",response.data)
  self.assertNotIn("api_key",str(response.data))
 def test_social_status_refuses_customer_and_marks_providers_uncertified(self):
  self.api.force_authenticate(user=self.customer)
  self.assertEqual(self.api.get("/api/settings/console-status/social-login/").status_code,403)
  self.api.force_authenticate(user=self.admin)
  data=self.api.get("/api/settings/console-status/social-login/")
  self.assertEqual(data.status_code,200,data.data)
  self.assertEqual({i["name"] for i in data.data["items"]},{"Google","Apple","Facebook"})
  self.assertFalse(data.data["provider_certified"])

 def test_brevo_first_and_resend_backup_status_does_not_echo_secrets(self):
  self.api.force_authenticate(user=self.customer)
  self.assertEqual(self.api.get("/api/settings/console-mail/senders/").status_code,403)
  self.api.force_authenticate(user=self.admin)
  result=self.api.get("/api/settings/console-mail/senders/")
  self.assertEqual(result.status_code,200,result.data)
  self.assertEqual(result.data["primary"],"brevo")
  self.assertEqual(result.data["fallback"],"resend")
  self.assertFalse(result.data["outbound_enabled"])
  self.assertEqual({s["key"] for s in result.data["senders"]},{"brevo","resend"})
  self.assertTrue(all(not s["live_verified"] for s in result.data["senders"]))
  self.assertNotIn("api_key",str(result.data))
  self.assertNotIn("secret",str(result.data).lower())
 def test_sender_preferences_cannot_overlap_or_bypass_approval(self):
  self.api.force_authenticate(user=self.admin)
  endpoint="/api/settings/console-policy/mail/"
  rev=self.api.get(endpoint).data["revision"]
  bad=self.api.patch(endpoint,{"revision":rev,"changes":{
   "primary_sender":"resend","fallback_sender":"resend"}},format="json")
  self.assertEqual(bad.status_code,400,bad.data)
  result=self.api.patch(endpoint,{"revision":rev,"changes":{
   "primary_sender":"brevo","fallback_sender":"none"}},format="json")
  self.assertEqual(result.status_code,200,result.data)
  self.assertFalse(self.api.get("/api/settings/console-mail/senders/").data["outbound_enabled"])
