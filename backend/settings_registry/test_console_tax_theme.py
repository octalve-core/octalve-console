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
  response=self.api.get("/api/settings/console-tax/")
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
