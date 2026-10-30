"""Internal mail dispatch state machine.

No sender adapters are registered by default. Integration Store certification
must supply verified sender implementations; never construct them from an
operator-controlled provider name, API key, URL, or template text.
"""
from dataclasses import dataclass
from datetime import timedelta
import re
from django.db import transaction
from django.utils import timezone
from .models import ConsoleMailOutbox, ConsoleMailAttempt

MAX_CYCLES = 3
LEASE = timedelta(minutes=10)

@dataclass(frozen=True)
class DeliveryResult:
    """A provider-verified result, not a redirect or untrusted callback."""
    outcome: str  # accepted, refused or unknown
    receipt: str = ""
    error_code: str = ""

def _mark_ambiguous(message, provider, code):
    message.status = "needs_review"
    message.provider = provider
    message.last_error_code = code[:80]
    message.next_attempt_at = None
    message.save(update_fields=["status","provider","last_error_code","next_attempt_at"])
    ConsoleMailAttempt.objects.create(outbox=message,provider=provider or "unknown",
        outcome="unknown",receipt="")

def _valid_sender(sender):
    name = getattr(sender,"name",None)
    # Verified adapter registration must be supplied by trusted code; no
    # registry is wired to the current draft-only supplier credentials.
    return (getattr(sender,"certified",False) is True and isinstance(name,str) and
            bool(re.fullmatch(r"[a-z0-9][a-z0-9_-]{1,78}",name)) and
            callable(getattr(sender,"send",None)))

def deliver_queued_once(outbox_id, *, senders):
    """A single bounded attempt cycle, never called by a public API.

    A definitive refusal permits fallback; a timeout/unknown receipt does not.
    The external call is made *outside* the database transaction. If the worker
    dies after provider acceptance, the lease expires to NEEDS_REVIEW instead
    of silently sending duplicates.
    """
    verified=list(senders)
    if not verified or not all(_valid_sender(s) for s in verified):
        return False
    if len(verified)>5 or len({s.name for s in verified})!=len(verified):
        raise ValueError("Untrusted or duplicate sender chain.")
    with transaction.atomic():
        msg=ConsoleMailOutbox.objects.select_for_update().get(pk=outbox_id)
        if msg.status!="queued" or (msg.next_attempt_at and msg.next_attempt_at>timezone.now()):
            return False
        if msg.attempts>=MAX_CYCLES:
            return False
        msg.status="processing"
        msg.attempts+=1
        msg.next_attempt_at=timezone.now()+LEASE
        msg.save(update_fields=["status","attempts","next_attempt_at"])
    for sender in verified:
        try:
            result=sender.send(
                recipient=msg.recipient,subject=msg.subject,
                body_text=msg.body_text,body_html=msg.body_html,
                idempotency_key=msg.idempotency_key
            )
        except Exception:
            # Failure may have happened AFTER provider accepted. Never guess.
            result=DeliveryResult("unknown",error_code="transport_uncertain")
        if not isinstance(result,DeliveryResult) or result.outcome not in ("accepted","refused","unknown"):
            result=DeliveryResult("unknown",error_code="invalid_provider_response")
        with transaction.atomic():
            record=ConsoleMailOutbox.objects.select_for_update().get(pk=msg.pk)
            # A competing administrative resolution or revocation wins.
            if record.status!="processing":
                return False
            if result.outcome=="unknown":
                _mark_ambiguous(record,sender.name,result.error_code or "unconfirmed_result")
                return False
            if result.outcome=="accepted":
                receipt=result.receipt
                if (not isinstance(receipt,str) or
                    not 1<=len(receipt)<=255 or
                    any(ord(c)<32 for c in receipt)):
                    _mark_ambiguous(record,sender.name,"missing_acceptance_receipt")
                    return False
                ConsoleMailAttempt.objects.create(outbox=record,provider=sender.name,
                    outcome="accepted",receipt=receipt)
                record.status="sent"
                record.provider=sender.name
                record.provider_receipt=receipt
                record.last_error_code=""
                record.sent_at=timezone.now()
                record.next_attempt_at=None
                record.save(update_fields=["status","provider","provider_receipt",
                    "last_error_code","sent_at","next_attempt_at"])
                return True
            # A trustworthy definitive refusal: another verified sender may try.
            ConsoleMailAttempt.objects.create(outbox=record,provider=sender.name,
                outcome="refused",receipt="")
            record.provider=sender.name
            record.last_error_code=(result.error_code or "provider_refused")[:80]
            record.save(update_fields=["provider","last_error_code"])
    # All candidates have confirmed that they did not accept the message.
    with transaction.atomic():
        record=ConsoleMailOutbox.objects.select_for_update().get(pk=msg.pk)
        if record.status!="processing":
            return False
        record.status="failed" if record.attempts>=MAX_CYCLES else "queued"
        record.next_attempt_at=(None if record.status=="failed" else
            timezone.now()+timedelta(minutes=min(60,2**record.attempts)))
        record.save(update_fields=["status","next_attempt_at"])
    return False

def quarantine_expired_attempts(*,limit=100):
    """Never resend a possibly-accepted message after worker interruption."""
    if not isinstance(limit,int) or not 1<=limit<=100:
        raise ValueError("Invalid recovery limit.")
    changed=0
    ids=list(ConsoleMailOutbox.objects.filter(status="processing",
        next_attempt_at__lte=timezone.now()).order_by("pk")
        .values_list("pk",flat=True)[:limit])
    for pk in ids:
        with transaction.atomic():
            msg=ConsoleMailOutbox.objects.select_for_update().get(pk=pk)
            if msg.status=="processing" and msg.next_attempt_at and msg.next_attempt_at<=timezone.now():
                _mark_ambiguous(msg,msg.provider or "unknown","interrupted_delivery")
                changed+=1
    return changed
