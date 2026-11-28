"""SET-04 mail state-machine regression: no duplicate sends after uncertainty."""
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from settings_registry.models import EmailTemplate,ConsoleMailOutbox,ConsoleMailAttempt,EmailTemplateRevision
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

 def test_delivery_attempt_receipts_and_revision_history_are_append_only(self):
  attempt=ConsoleMailAttempt.objects.create(
   outbox=self.msg,provider="smtp_primary",outcome="refused",receipt="")
  attempt.receipt="forged"
  with self.assertRaises(ValueError):
   attempt.save()
  with self.assertRaises(ValueError):
   attempt.delete()
  revision=EmailTemplateRevision.objects.create(
   template=self.template,revision=1,snapshot={"subject":"Invoice"})
  revision.snapshot={"subject":"changed"}
  with self.assertRaises(ValueError):
   revision.save()
  with self.assertRaises(ValueError):
   revision.delete()


class BrevoTransportTests(TestCase):
 def test_exact_sender_and_domain_required(self):
  from unittest.mock import Mock
  from .brevo_transport import verify_sender,SenderRefused
  call=Mock(side_effect=[(200,{"domain":"example.test","verified":True,"authenticated":True}),
    (200,{"senders":[{"email":"mail@example.test","active":True}]})])
  self.assertTrue(verify_sender("example.test","mail@example.test","synthetic-api-key",request=call))
  call=Mock(return_value=(200,{"domain":"example.test","verified":True,"authenticated":False}))
  with self.assertRaises(SenderRefused):
   verify_sender("example.test","mail@example.test","synthetic-api-key",request=call)
  self.assertEqual(call.call_count,1)

 def test_acceptance_requires_exact_receipt_and_uncertainty_is_not_retryable(self):
  from unittest.mock import Mock
  from .brevo_transport import send_message,SenderRefused
  args=dict(key="synthetic-api-key",sender="mail@example.test",sender_name="Octalve Cloud",
     reply_to="support@example.test",recipient="customer@example.test",subject="Receipt",
     body_text="Hello",body_html="<p>Hello</p>",idempotency_key="invoice:42:payment_confirmed")
  request=Mock(return_value=(201,{"messageId":"<receipt@example.test>"}))
  result=send_message(**args,request=request)
  self.assertEqual(result.outcome,"accepted")
  self.assertEqual(len(request.call_args.kwargs["payload"]["to"]),1)
  for response in ((201,{}),(500,{}),(409,{})):
   self.assertEqual(send_message(**args,request=Mock(return_value=response)).outcome,"unknown")
  self.assertEqual(send_message(**args,request=Mock(side_effect=SenderRefused())).outcome,"unknown")
  self.assertEqual(send_message(**args,request=Mock(return_value=(401,{}))).outcome,"refused")

 def test_unverified_notice_never_authorizes_delivery(self):
  from .mail_runtime import current_message
  template=EmailTemplate.objects.get(key="payment_confirmed")
  template.is_active=True
  template.save(update_fields=["is_active"])
  notice=ConsoleMailOutbox.objects.create(template=template,
    idempotency_key="invoice:999999:payment_confirmed",recipient="customer@example.test",
    subject="Receipt",body_text="Hello",body_html="<p>Hello</p>",audience="transactional")
  self.assertFalse(current_message(notice))

 def test_protected_worker_ignores_arbitrary_recipient_parameters(self):
  from unittest.mock import patch
  from rest_framework.test import APIClient
  api=APIClient()
  path="/api/settings/console-mail/delivery/cron/"
  with patch.dict("os.environ",{"CRON_SECRET":"synthetic-worker-test-only-0123456789abcdef"}),patch(
    "settings_registry.mail_runtime.run_due_mail",return_value={"enabled":False}) as run:
   self.assertEqual(api.get(path).status_code,401)
   self.assertEqual(api.post(path,{},format="json").status_code,405)
   result=api.get(path+"?recipient=invalid",HTTP_AUTHORIZATION="Bearer synthetic-worker-test-only-0123456789abcdef")
   self.assertEqual(result.status_code,200)
   run.assert_called_once_with(2)


class ResendTransportTests(TestCase):
 def test_domain_must_be_exact_and_verified(self):
  from unittest.mock import Mock
  from .resend_transport import verify_domain,SenderRefused
  call=Mock(return_value=(200,{"data":[{"name":"example.test","status":"verified"}],"has_more":False}))
  self.assertTrue(verify_domain("example.test","synthetic",request=call))
  with self.assertRaises(SenderRefused):
   verify_domain("different.test","synthetic",request=call)
 def test_acceptance_refusal_and_uncertainty(self):
  from unittest.mock import Mock
  from .resend_transport import send_message
  args=dict(key="fixture",sender="mail@example.test",sender_name="Octalve",reply_to="support@example.test",
   recipient="customer@example.test",subject="Receipt",body_text="Hello",body_html="<p>Hello</p>",idempotency_key="invoice:1:payment_confirmed")
  call=Mock(return_value=(200,{"id":"12345678-1234-4234-8234-123456789abc"}))
  self.assertEqual(send_message(**args,request=call).outcome,"accepted")
  self.assertEqual(len(call.call_args.kwargs["event"]),64)
  for status,expected in ((403,"refused"),(409,"unknown"),(500,"unknown"),(200,"unknown")):
   self.assertEqual(send_message(**args,request=Mock(return_value=(status,{}))).outcome,expected)


class SuppressionReadbackTests(TestCase):
 def test_brevo_requires_complete_inventory(self):
  from unittest.mock import Mock
  from .brevo_transport import recipient_suppressed,SenderRefused
  self.assertTrue(recipient_suppressed("user@example.test","fixture",request=Mock(return_value=(200,{"contacts":[{"email":"USER@example.test"}],"count":1}))))
  self.assertFalse(recipient_suppressed("user@example.test","fixture",request=Mock(return_value=(200,{"contacts":[],"count":0}))))
  with self.assertRaises(SenderRefused):
   recipient_suppressed("user@example.test","fixture",request=Mock(return_value=(200,{"contacts":[],"count":10})))
 def test_resend_suppression_pagination_and_unavailable(self):
  from unittest.mock import Mock
  from .resend_transport import recipient_suppressed,SenderRefused
  self.assertFalse(recipient_suppressed("user@example.test","fixture",request=Mock(return_value=(200,{"object":"list","data":[],"has_more":False}))))
  self.assertTrue(recipient_suppressed("user@example.test","fixture",request=Mock(return_value=(200,{"object":"list","data":[{"email":"user@example.test"}],"has_more":False}))))
  with self.assertRaises(SenderRefused):
   recipient_suppressed("user@example.test","fixture",request=Mock(return_value=(403,{})))
 def test_bounce_is_not_delivery_and_receipt_identity_is_required(self):
  from unittest.mock import Mock
  from .brevo_transport import delivery_state,SenderRefused
  receipt="<fixture@example.test>"
  row={"email":"user@example.test","messageId":receipt,"event":"hardBounce"}
  self.assertEqual(delivery_state("user@example.test",receipt,"fixture",request=Mock(return_value=(200,{"events":[row]}))),"suppressed")
  with self.assertRaises(SenderRefused):
   delivery_state("other@example.test",receipt,"fixture",request=Mock(return_value=(200,{"events":[row]})))

class SuppressionDispatchTests(MailDispatchTests):
 def test_suppressed_recipient_never_falls_back(self):
  primary=FakeVerifiedSender("smtp_primary","suppressed")
  fallback=FakeVerifiedSender("api_secondary","accepted","receipt-3")
  self.assertFalse(deliver_queued_once(self.msg.pk,senders=[primary,fallback]))
  self.msg.refresh_from_db()
  self.assertEqual(self.msg.status,"suppressed")
  self.assertEqual(fallback.calls,0)

class StaleTransactionalQueueTests(TestCase):
    def test_expired_queue_requires_review_without_sending(self):
        from datetime import timedelta
        from django.utils import timezone
        from settings_registry.models import EmailTemplate,ConsoleMailOutbox
        from settings_registry.mail_runtime import expire_stale_queue,KEYS
        template=EmailTemplate.objects.filter(key__in=KEYS).first()
        self.assertIsNotNone(template)
        def message(key):
            return ConsoleMailOutbox.objects.create(idempotency_key=key,template=template,
                recipient="fixture@example.test",subject="Fixture",body_text="Fixture",
                body_html="<p>Fixture</p>",audience="transactional")
        old=message("fixture:old-notice")
        fresh=message("fixture:new-notice")
        ConsoleMailOutbox.objects.filter(pk=old.pk).update(created_at=timezone.now()-timedelta(days=8))
        self.assertEqual(expire_stale_queue(),1)
        old.refresh_from_db();fresh.refresh_from_db()
        self.assertEqual(old.status,"needs_review")
        self.assertEqual(old.last_error_code,"notice_expired_unsent")
        self.assertEqual(fresh.status,"queued")
        self.assertEqual(expire_stale_queue(),0)
