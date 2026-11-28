"""Paystack financial exception inbox and independently verified review receipts.

No automatic refunds, dispute acceptance, financial reversals or deletion.
Original settlement evidence remains immutable. Exception evidence is redacted.
"""
import hashlib
import json
import re
from decimal import Decimal
import requests
from django.db import transaction,DatabaseError
from django.utils import timezone
from django.views.decorators.debug import sensitive_variables
from audit.models import AuditLog
from .models import Transaction,WebhookEvent,PaymentGateway
from .live_binding import resolve_live_key

EVENTS=frozenset(("refund.pending","refund.processing","refund.processed","refund.failed",
    "charge.dispute.create","charge.dispute.remind","charge.dispute.resolve"))
REFUND_STATES=frozenset(("pending","processing","processed","failed","needs-attention"))
DISPUTE_STATES=frozenset(("awaiting-merchant-feedback","awaiting-bank-feedback","pending","resolved","archived"))
ID=re.compile(r"^[0-9]{1,35}$")

class ExceptionRefused(ValueError):
    pass

def numeric_id(value):
    if type(value) not in (int,str) or not ID.fullmatch(str(value)):
        raise ExceptionRefused("Invalid supplier identifier.")
    return str(value)

def remote_transaction(value):
    return numeric_id(value.get("id") if isinstance(value,dict) else value)

def record_signed(gateway,event,body):
    if gateway.code!="paystack" or gateway.test_mode or not resolve_live_key(gateway):
        raise ExceptionRefused("Live gateway authority required.")
    if event not in EVENTS or body.get("domain")!="live":
        raise ExceptionRefused("Unapproved financial event.")
    remote=numeric_id(body.get("id"))
    original=remote_transaction(body.get("transaction"))
    # A status notification is evidence of a case, not proof of money movement.
    payload={"mode":"live","binding":gateway.config,"case_id":remote,"transaction_id":original}
    fingerprint=hashlib.sha256(json.dumps([gateway.pk,event,remote,original],separators=(",",":")).encode()).hexdigest()
    with transaction.atomic():
        saved,created=WebhookEvent.objects.get_or_create(event_id="cloud_exception_"+fingerprint,
            defaults={"gateway":gateway,"event_type":event,"payload":payload,"is_verified":True,"headers":{}})
        if saved.gateway_id!=gateway.pk or any(saved.payload.get(k)!=v for k,v in payload.items()) or not saved.is_verified:
            raise ExceptionRefused("Conflicting financial event.")
    return saved,created

@sensitive_variables("key")
def fetch_case(kind,case_id,key):
    case_id=numeric_id(case_id)
    if kind not in ("refund","dispute") or not key:
        raise ExceptionRefused("Case authority unavailable.")
    session=requests.Session()
    session.trust_env=False
    try:
        with session.get("https://api.paystack.co/"+kind+"/"+case_id,
             headers={"Authorization":"Bearer "+key,"Accept":"application/json"},
             timeout=(3,8),allow_redirects=False,verify=True,stream=True) as response:
            if response.status_code!=200:
                raise ExceptionRefused("Case readback unavailable.")
            raw=bytearray()
            for chunk in response.iter_content(chunk_size=4096):
                raw.extend(chunk)
                if len(raw)>131072:
                    raise ExceptionRefused("Case response too large.")
            packet=json.loads(raw)
        if not isinstance(packet,dict) or packet.get("status") is not True or not isinstance(packet.get("data"),dict):
            raise ExceptionRefused("Invalid case response.")
        return packet["data"]
    except (requests.RequestException,ValueError,TypeError):
        raise ExceptionRefused("Case readback unavailable.") from None
    finally:
        session.close()

def verified_case(event,data):
    kind="refund" if event.event_type.startswith("refund.") else "dispute"
    if (not isinstance(data,dict) or data.get("domain")!="live"
        or numeric_id(data.get("id"))!=event.payload["case_id"]
        or remote_transaction(data.get("transaction"))!=event.payload["transaction_id"]):
        raise ExceptionRefused("Case identity mismatch.")
    state=data.get("status")
    if state not in (REFUND_STATES if kind=="refund" else DISPUTE_STATES):
        raise ExceptionRefused("Unrecognized case state.")
    amount=data.get("amount" if kind=="refund" else "refund_amount")
    if amount is not None and (type(amount) is not int or not 0<=amount<=999999999999):
        raise ExceptionRefused("Invalid case amount.")
    currency=data.get("currency")
    if currency is not None and (not isinstance(currency,str) or not re.fullmatch(r"[A-Z]{3}",currency)):
        raise ExceptionRefused("Invalid case currency.")
    return {"kind":kind,"case_id":event.payload["case_id"],"transaction_id":event.payload["transaction_id"],
            "state":state,"amount_minor":amount,"currency":currency}

def consume(event_id):
    try:
        event=WebhookEvent.objects.select_related("gateway").get(pk=event_id,is_verified=True,event_type__in=EVENTS,
            gateway__code="paystack",gateway__test_mode=False,gateway__status="active")
        if event.is_processed:
            return "processed"
        key=resolve_live_key(event.gateway)
        if not key or event.payload.get("mode")!="live" or event.payload.get("binding")!=event.gateway.config:
            return "held"
        kind="refund" if event.event_type.startswith("refund.") else "dispute"
        proof=verified_case(event,fetch_case(kind,event.payload["case_id"],key))
        with transaction.atomic():
            fresh=WebhookEvent.objects.select_for_update().get(pk=event.pk)
            gateway=PaymentGateway.objects.select_for_update().get(pk=event.gateway_id)
            if fresh.is_processed:
                return "processed"
            if fresh.payload!=event.payload or gateway.config!=event.gateway.config or not resolve_live_key(gateway):
                return "held"
            matches=list(Transaction.objects.select_for_update().filter(gateway=gateway,transaction_type="payment",
                status="successful",provider_reference=proof["transaction_id"],metadata__provider_api_verified=True)[:2])
            if len(matches)!=1:
                return "held"
            original=matches[0]
            if (proof["currency"] not in (None,original.currency) or
                (proof["amount_minor"] is not None and Decimal(proof["amount_minor"])/100>original.amount)):
                return "held"
            # A confirmed case puts new fulfillment on review; no existing service
            # is remotely suspended, deleted, or refunded automatically.
            original.metadata={**original.metadata,"financial_exception_review_required":True}
            original.save(update_fields=["metadata","updated_at"])
            AuditLog.objects.create(actor=None,action="payment_exception_verified",entity_type="Transaction",
                entity_id=str(original.pk),entity_name="Paystack financial exception",
                details={**proof,"event_id":fresh.pk,"invoice_id":original.invoice_id,"review_required":True})
            fresh.payload={**fresh.payload,"verified_case":proof}
            fresh.is_processed=True
            fresh.processed_at=timezone.now()
            fresh.error_message=""
            fresh.save(update_fields=["payload","is_processed","processed_at","error_message"])
        return "processed"
    except (ExceptionRefused,WebhookEvent.DoesNotExist,PaymentGateway.DoesNotExist,DatabaseError,KeyError,TypeError,ValueError):
        return "held"
