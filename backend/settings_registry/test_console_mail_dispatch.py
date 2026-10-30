"""SET-04 mail state-machine regression: no duplicate sends after uncertainty."""
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from settings_registry.models import EmailTemplate,ConsoleMailOutbox,ConsoleMailAttempt
from settings_registry.mail_dispatch import (
    DeliveryResult,deliver_queued_once,quarantine_expired_attempts,MAX_CYCLES
)

class FakeVerifiedSender:
 certified=True
 def __init__(self,name,outcome,receipt="",error_code=""):
  self.name=name;self.outcome=outcome;self.receipt=receipt
  self.error_code=error_code;self.calls=0
 def send(self,**kwargs):
  self.calls+=1
  assert kwargs["idempotency_key"].startswith("test:mail:")
  return DeliveryResult(self.outcome,self.receipt,self.error_code)

class MailDispatchTests(TestCase):
 def setUp(self):
  self.template=EmailTemplate.objects.create(key="test_dispatch",
   name="Dispatch",category="billing",subject="Invoice",body_text="Hello",is_active=True)
  self.msg=ConsoleMailOutbox.objects.create(idempotency_key="test:mail:123456",
   template=self.template,recipient="user@example.invalid",subject="Invoice",
   body_text="Hello",body_html="<p>Hello</p>",audience="transactional")
 def test_unverified_or_missing_adapters_cannot_send(self):
  sender=FakeVerifiedSender("smtp_primary","accepted","receipt-1")
  sender.certified=False
  self.assertFalse(deliver_queued_once(self.msg.pk,senders=[sender]))
  self.assertFalse(deliver_queued_once(self.msg.pk,senders=[]))
  self.assertEqual(sender.calls,0)
  self.msg.refresh_from_db()
  self.assertEqual(self.msg.status,"queued")
 def test_delivery_requires_receipt_and_never_repeats_accepted(self):
  primary=FakeVerifiedSender("smtp_primary","accepted","idempotent-confirmation")
  self.assertTrue(deliver_queued_once(self.msg.pk,senders=[primary]))
  self.assertFalse(deliver_queued_once(self.msg.pk,senders=[primary]))
  self.assertEqual(primary.calls,1)
  self.msg.refresh_from_db()
  self.assertEqual(self.msg.status,"sent")
  self.assertEqual(self.msg.provider_receipt,"idempotent-confirmation")
  self.assertEqual(ConsoleMailAttempt.objects.filter(outbox=self.msg,outcome="accepted").count(),1)
 def test_definitive_refusal_allows_fallback(self):
  first=FakeVerifiedSender("smtp_primary","refused",error_code="provider_rejected")
  second=FakeVerifiedSender("api_secondary","accepted","receipt-2")
  self.assertTrue(deliver_queued_once(self.msg.pk,senders=[first,second]))
  self.msg.refresh_from_db()
  self.assertEqual(self.msg.provider,"api_secondary")
  self.assertEqual(first.calls,1)
  self.assertEqual(second.calls,1)
  self.assertEqual(list(ConsoleMailAttempt.objects.filter(outbox=self.msg).order_by("pk")
      .values_list("outcome",flat=True)),["refused","accepted"])
 def test_timeout_quarantines_and_never_triggers_fallback(self):
  primary=FakeVerifiedSender("smtp_primary","unknown",error_code="timeout")
  fallback=FakeVerifiedSender("api_secondary","accepted","receipt-3")
  self.assertFalse(deliver_queued_once(self.msg.pk,senders=[primary,fallback]))
  self.msg.refresh_from_db()
  self.assertEqual(self.msg.status,"needs_review")
  self.assertEqual(primary.calls,1)
  self.assertEqual(fallback.calls,0)
  self.assertFalse(deliver_queued_once(self.msg.pk,senders=[fallback]))
 def test_accepted_without_receipt_requires_reconciliation(self):
  primary=FakeVerifiedSender("smtp_primary","accepted")
  secondary=FakeVerifiedSender("api_secondary","accepted","receipt-4")
  self.assertFalse(deliver_queued_once(self.msg.pk,senders=[primary,secondary]))
  self.msg.refresh_from_db()
  self.assertEqual(self.msg.status,"needs_review")
  self.assertEqual(secondary.calls,0)
 def test_all_confirmed_refused_apply_bounded_backoff_then_fail(self):
  first=FakeVerifiedSender("smtp_primary","refused",error_code="busy")
  for attempt in range(MAX_CYCLES):
   self.assertFalse(deliver_queued_once(self.msg.pk,senders=[first]))
   self.msg.refresh_from_db()
   self.assertEqual(self.msg.status,"failed" if attempt==MAX_CYCLES-1 else "queued")
   if attempt<MAX_CYCLES-1:
    self.msg.next_attempt_at=timezone.now()-timedelta(seconds=1)
    self.msg.save(update_fields=["next_attempt_at"])
  self.assertEqual(self.msg.attempts,MAX_CYCLES)
  self.assertEqual(first.calls,MAX_CYCLES)
 def test_interrupted_inflight_attempt_is_quarantined_without_resend(self):
  self.msg.status="processing"
  self.msg.next_attempt_at=timezone.now()-timedelta(seconds=1)
  self.msg.attempts=1
  self.msg.save(update_fields=["status","next_attempt_at","attempts"])
  self.assertEqual(quarantine_expired_attempts(),1)
  self.msg.refresh_from_db()
  self.assertEqual(self.msg.status,"needs_review")
  sender=FakeVerifiedSender("smtp_primary","accepted","receipt-5")
  self.assertFalse(deliver_queued_once(self.msg.pk,senders=[sender]))
  self.assertEqual(sender.calls,0)
