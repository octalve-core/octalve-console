"""SET-01: persisted, optimistic-locking operator settings and denial tests."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from settings_registry.models import Setting, SettingChangeLog
class ConsolePolicyAPITests(TestCase):
 def setUp(self):
  U=get_user_model()
  self.admin=U.objects.create_superuser(email="settings-owner@example.invalid",username="settings_owner",password="Unused-test-only!")
  self.staff=U.objects.create_user(email="settings-staff@example.invalid",username="settings_staff",password="Unused-test-only!",role="staff",is_staff=True)
  self.client_user=U.objects.create_user(email="settings-customer@example.invalid",username="settings_customer",password="Unused-test-only!")
  self.api=APIClient()
  # Run migration-seeded keys as real records; tests should not depend on command execution.
  from settings_registry.console_policy import MANIFEST
  from settings_registry.models import SettingGroup
  for group,items in MANIFEST.items():
   g,_=SettingGroup.objects.get_or_create(key=group,defaults={"name":group})
   for key,(label,kind,default,effect) in items.items():
    Setting.objects.get_or_create(group=g,key=key,defaults={"name":label,"data_type":"string","default_value":default,"value":default})
 def url(self,s="general"):
  return "/api/settings/console-policy/"+s+"/"
 def test_only_super_admin_can_read_and_write(self):
  for actor in (None,self.client_user,self.staff):
   self.api.force_authenticate(user=actor)
   result=self.api.get(self.url())
   self.assertIn(result.status_code,(401,403))
   result=self.api.patch(self.url(),{"revision":"invalid","changes":{"company_name":"Hostile"}} ,format="json")
   self.assertIn(result.status_code,(401,403))
  self.api.force_authenticate(user=self.admin)
  self.assertEqual(self.api.get(self.url()).status_code,200)
 def test_persisted_dirty_fields_receipt_and_replay_conflict(self):
  self.api.force_authenticate(user=self.admin)
  before=self.api.get(self.url()).data
  saved=self.api.patch(self.url(),{"revision":before["revision"],"changes":{"company_name":"Octalve Owner"}} ,format="json")
  self.assertEqual(saved.status_code,200,saved.data)
  self.assertEqual(saved.data["changed"],["company_name"])
  self.assertNotEqual(saved.data["revision"],before["revision"])
  self.assertEqual(self.api.get(self.url()).data["fields"][0]["value"],"Octalve Owner")
  log=SettingChangeLog.objects.last()
  self.assertIsNone(log.old_value)
  self.assertIsNone(log.new_value)
  stale=self.api.patch(self.url(),{"revision":before["revision"],"changes":{"company_name":"Overwrite"}} ,format="json")
  self.assertEqual(stale.status_code,409)
 def test_allowlist_disallows_credential_and_runtime_security_flags(self):
  self.api.force_authenticate(user=self.admin)
  revision=self.api.get(self.url()).data["revision"]
  for change in ({"DEBUG":"true"},{"is_superuser":"true"},{"wallet_balance":"999999"},{"company_name":"X"},{"company_name":"A\r\nInjected"}):
   result=self.api.patch(self.url(),{"revision":revision,"changes":change},format="json")
   self.assertEqual(result.status_code,400,(change,result.data))
  self.assertEqual(self.api.get(self.url()).data["revision"],revision)
 def test_prefix_and_theme_values_are_validated(self):
  self.api.force_authenticate(user=self.admin)
  for section,key,bad in (("invoices","invoice_prefix","../hack"),("theme","primary_color","#000000"),("general","timezone","Not/Timezone")):
   revision=self.api.get(self.url(section)).data["revision"]
   result=self.api.patch(self.url(section),{"revision":revision,"changes":{key:bad}},format="json")
   self.assertEqual(result.status_code,400,result.data)
 def test_unknown_section_cannot_be_mutated(self):
  self.api.force_authenticate(user=self.admin)
  self.assertEqual(self.api.get(self.url("integrations")).status_code,404)
