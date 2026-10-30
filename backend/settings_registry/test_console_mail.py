"""SET-04: safe event templates, explicit consent and auditable durable outbox."""
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from settings_registry.models import EmailTemplate,EmailTemplateRevision,ConsoleMailOutbox
from settings_registry.mail_authority import render,queue_templated_message,queue_invoice_issued
from billing.models import Invoice

class ConsoleMailPolicyTests(TestCase):
 def setUp(self):
  U=get_user_model()
  self.admin=U.objects.create_superuser(email="mail-owner@example.invalid",username="mail_owner",password="Unused-test-only!")
  self.customer=U.objects.create_user(email="mail-customer@example.invalid",username="mail_customer",password="Unused-test-only!")
  self.staff=U.objects.create_user(email="mail-staff@example.invalid",username="mail_staff",password="Unused-test-only!",role="staff",is_staff=True)
  self.api=APIClient()
 def test_template_routes_refuse_unauthorized_mutations(self):
  for actor in (None,self.customer,self.staff):
   self.api.force_authenticate(user=actor)
   for url in ("/api/settings/console-mail/templates/","/api/settings/console-mail/outbox/"):
    self.assertIn(self.api.get(url).status_code,(401,403))
   self.assertIn(self.api.post("/api/settings/console-mail/templates/",{},format="json").status_code,(401,403))
 def test_create_edit_duplicate_preview_and_stale_revision(self):
  self.api.force_authenticate(user=self.admin)
  list_endpoint="/api/settings/console-mail/templates/"
  created=self.api.post(list_endpoint,{"name":"New invoice alert","category":"billing",
    "subject":"Invoice {{invoice.number}}","body_text":"Hi {{customer.first_name}}, your invoice {{invoice.number}} is ready.",
    "is_active":False},format="json")
  self.assertEqual(created.status_code,201,created.data)
  pk=created.data["id"]
  self.assertFalse(created.data["is_active"])
  endpoint=f"{list_endpoint}{pk}/"
  updated=self.api.patch(endpoint,{"revision":created.data["revision"],"subject":"Your invoice {{invoice.number}}"},format="json")
  self.assertEqual(updated.status_code,200,updated.data)
  self.assertEqual(EmailTemplateRevision.objects.filter(template_id=pk).count(),2)
  stale=self.api.patch(endpoint,{"revision":created.data["revision"],"is_active":True},format="json")
  self.assertEqual(stale.status_code,409)
  sample=self.api.post(endpoint+"preview/",{},format="json")
  self.assertEqual(sample.status_code,200,sample.data)
  self.assertIn("INV-2026-00001",sample.data["subject"])
  clone=self.api.post(endpoint+"duplicate/",{},format="json")
  self.assertEqual(clone.status_code,201,clone.data)
  self.assertFalse(clone.data["is_active"])
  self.assertNotEqual(clone.data["key"],created.data["key"])
 def test_rejects_header_injection_unknown_fields_and_script_templates(self):
  self.api.force_authenticate(user=self.admin)
  endpoint="/api/settings/console-mail/templates/"
  good={"name":"Valid notice","category":"billing","subject":"Hello {{customer.first_name}}",
      "body_text":"Hi {{customer.first_name}}"}
  for attempted in (
    {**good,"subject":"Subject\r\nBcc: dangerous@example.invalid"},
    {**good,"subject":"Hello {{unknown.key}}"},
    {**good,"is_superuser":True},
  ):
   self.assertEqual(self.api.post(endpoint,attempted,format="json").status_code,400)
  item=EmailTemplate.objects.create(key="safe_escape",name="Safe escape",category="billing",
      subject="Hello {{customer.first_name}}",body_text="Hi {{customer.first_name}}",
      body_html="<script>alert(1)</script>",is_active=True)
  result=render(item,{"customer.first_name":"<img src=x onerror=alert(1)>"})
  self.assertNotIn("<img",result["body_html"])
  self.assertNotIn("<script",result["body_html"])
  self.assertIn("&lt;img",result["body_html"])
 def test_queue_is_idempotent_and_requires_explicit_marketing_consent(self):
  template=EmailTemplate.objects.create(key="receipt_notice",name="Receipt",category="billing",
      subject="Invoice {{invoice.number}}",body_text="Hello {{customer.first_name}}",
      body_html="",is_active=True)
  data={"invoice.number":"INV-123","customer.first_name":"Amina"}
  first,created=queue_templated_message(event_key="invoice:123:issued",template_key="receipt_notice",
      recipient="recipient@example.invalid",context=data)
  self.assertTrue(created)
  second,created=queue_templated_message(event_key="invoice:123:issued",template_key="receipt_notice",
      recipient="recipient@example.invalid",context=data)
  self.assertFalse(created)
  self.assertEqual(first.pk,second.pk)
  self.assertEqual(ConsoleMailOutbox.objects.count(),1)
  self.assertEqual(first.status,"queued")
  promo=EmailTemplate.objects.create(key="promo_notice",name="Promotion",category="marketing",
      subject="Hello {{customer.first_name}}",body_text="Offer for {{customer.first_name}}",
      body_html="",is_active=True)
  with self.assertRaises(ValueError):
   queue_templated_message(event_key="promotion:01:recipient",template_key=promo.key,
       recipient="recipient@example.invalid",context={"customer.first_name":"Amina"})
  self.assertEqual(ConsoleMailOutbox.objects.count(),1)
 def test_issued_invoice_number_stays_fixed_after_prefix_change(self):
  from settings_registry.models import Setting,SettingGroup
  group,_=SettingGroup.objects.get_or_create(key="invoices",defaults={"name":"Invoices"})
  record,_=Setting.objects.get_or_create(group=group,key="invoice_prefix",
      defaults={"name":"Prefix","value":"INV","default_value":"INV","data_type":"string"})
  first=Invoice.objects.create(client=self.customer,subtotal=Decimal("10.00"),
       total=Decimal("10.00"),due_date=timezone.now())
  old=first.invoice_number
  record.set_value("OCT")
  second=Invoice.objects.create(client=self.customer,subtotal=Decimal("10.00"),
       total=Decimal("10.00"),due_date=timezone.now())
  self.assertTrue(old.startswith("INV-"))
  self.assertTrue(second.invoice_number.startswith("OCT-"))
  first.refresh_from_db()
  self.assertEqual(first.invoice_number,old)

 def test_invoice_issued_event_is_opt_in_idempotent_and_never_sends(self):
  template=EmailTemplate.objects.get(key="invoice_issued")
  self.assertFalse(template.is_active)
  invoice=Invoice.objects.create(client=self.customer,subtotal=Decimal("10.00"),
       total=Decimal("10.00"),due_date=timezone.now())
  self.assertFalse(queue_invoice_issued(invoice))
  self.assertFalse(ConsoleMailOutbox.objects.exists())
  template.is_active=True
  template.save(update_fields=["is_active"])
  self.assertTrue(queue_invoice_issued(invoice))
  self.assertFalse(queue_invoice_issued(invoice))
  self.assertEqual(ConsoleMailOutbox.objects.count(),1)
  row=ConsoleMailOutbox.objects.get()
  self.assertEqual(row.status,"queued")
  self.assertEqual(row.idempotency_key,f"invoice:{invoice.pk}:issued")
  self.assertFalse(row.provider_receipt)
  template.subject="Header {{unknown.token}}"
  template.save(update_fields=["subject"])
  second=Invoice.objects.create(client=self.customer,subtotal=Decimal("10.00"),
      total=Decimal("10.00"),due_date=timezone.now())
  self.assertFalse(queue_invoice_issued(second))
  self.assertEqual(ConsoleMailOutbox.objects.count(),1)
