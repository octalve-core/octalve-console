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
from .models import Transaction,WebhookEvent,PaymentGateway,PaymentIntent
from .live_binding import resolve_live_key

EVENTS=frozenset(("refund.pending","refund.processing","refund.processed","refund.failed","refund.needs-attention",
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
    if not isinstance(event,str) or event not in EVENTS or not isinstance(body,dict) or body.get("domain")!="live":
        raise ExceptionRefused("Unapproved financial event.")
    # Paystack refund webhooks may omit both numeric IDs. Resolve the
    # original transaction from our ledger, then independently list refunds.
    if event.startswith("refund.") and body.get("id") is None:
        reference=body.get("transaction_reference")
        if not isinstance(reference,str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{3,119}",reference):
            raise ExceptionRefused("Invalid payment reference.")
        amount=body.get("amount")
        if type(amount) not in (str,int) or not re.fullmatch(r"[0-9]{1,12}",str(amount)) or int(amount)<=0:
            raise ExceptionRefused("Invalid refund notification amount.")
        currency=body.get("currency")
        if not isinstance(currency,str) or not re.fullmatch(r"[A-Z]{3}",currency):
            raise ExceptionRefused("Invalid refund notification currency.")
        payload={"mode":"live","binding":gateway.config,"reference":reference,
                 "amount_minor":int(amount),"currency":currency}
    else:
        remote=numeric_id(body.get("id"))
        original=remote_transaction(body.get("transaction"))
        payload={"mode":"live","binding":gateway.config,"case_id":remote,"transaction_id":original}
    # A notification is evidence of a case, not proof of money movement.
    fingerprint=hashlib.sha256(json.dumps([gateway.pk,event,payload],sort_keys=True,separators=(",",":")).encode()).hexdigest()
    with transaction.atomic():
        current=PaymentGateway.objects.select_for_update().get(pk=gateway.pk)
        if current.config!=gateway.config or not resolve_live_key(current):
            raise ExceptionRefused("Gateway authority changed.")
        saved,created=WebhookEvent.objects.get_or_create(event_id="cloud_exception_"+fingerprint,
            defaults={"gateway":gateway,"event_type":event,"payload":payload,"is_verified":True,"headers":{}})
        if saved.gateway_id!=gateway.pk or any(saved.payload.get(k)!=v for k,v in payload.items()) or not saved.is_verified:
            raise ExceptionRefused("Conflicting financial event.")
        if created:
            originals=Transaction.objects.select_for_update().filter(gateway=gateway,transaction_type="payment",status="successful")
            originals=originals.filter(reference=payload["reference"]) if "reference" in payload else originals.filter(provider_reference=payload["transaction_id"])
            for original in originals:
                original.metadata={**original.metadata,"financial_exception_review_required":True}
                original.metadata.pop("financial_exception_closure_v1",None)
                original.save(update_fields=["metadata","updated_at"])
    return saved,created

@sensitive_variables("key")
def _read(path,key,params=None):
    if not key:
        raise ExceptionRefused("Case authority unavailable.")
    session=requests.Session()
    session.trust_env=False
    try:
        with session.get("https://api.paystack.co/"+path,params=params,
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
        if not isinstance(packet,dict) or packet.get("status") is not True or not isinstance(packet.get("data"),(dict,list)):
            raise ExceptionRefused("Invalid case response.")
        return packet["data"]
    except (requests.RequestException,ValueError,TypeError):
        raise ExceptionRefused("Case readback unavailable.") from None
    finally:
        session.close()

def fetch_case(kind,case_id,key):
    if kind not in ("refund","dispute"):
        raise ExceptionRefused("Invalid case type.")
    result=_read(kind+"/"+numeric_id(case_id),key)
    if not isinstance(result,dict):
        raise ExceptionRefused("Invalid case response.")
    return result

def fetch_refund_candidates(transaction_id,key):
    result=_read("refund",key,{"transaction":numeric_id(transaction_id),"perPage":50,"page":1})
    # Do not infer a unique refund from a truncated inventory.
    if not isinstance(result,list) or not 1<=len(result)<50 or any(not isinstance(x,dict) for x in result):
        raise ExceptionRefused("Refund inventory unavailable or incomplete.")
    return result

def verified_case(event,data,*,identity=None):
    identity=identity or event.payload
    kind="refund" if event.event_type.startswith("refund.") else "dispute"
    if (not isinstance(data,dict) or data.get("domain")!="live"
        or numeric_id(data.get("id"))!=identity["case_id"]
        or remote_transaction(data.get("transaction"))!=identity["transaction_id"]):
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
    return {"kind":kind,"case_id":identity["case_id"],"transaction_id":identity["transaction_id"],
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
        identity=event.payload
        if kind=="refund" and "case_id" not in identity:
            originals=list(Transaction.objects.filter(gateway=event.gateway,transaction_type="payment",status="successful",
                reference=identity["reference"],metadata__provider_api_verified=True)[:2])
            if len(originals)!=1:
                return "held"
            remote=numeric_id(originals[0].provider_reference)
            candidates=fetch_refund_candidates(remote,key)
            matches=[x for x in candidates if x.get("domain")=="live"
                and remote_transaction(x.get("transaction"))==remote
                and x.get("amount")==identity["amount_minor"] and x.get("currency")==identity["currency"]]
            if len(matches)!=1:
                return "held"
            identity={"case_id":numeric_id(matches[0].get("id")),"transaction_id":remote}
        proof=verified_case(event,fetch_case(kind,identity["case_id"],key),identity=identity)
        if "reference" in event.payload and (proof["amount_minor"]!=event.payload["amount_minor"] or proof["currency"]!=event.payload["currency"]):
            return "held"
        with transaction.atomic():
            gateway=PaymentGateway.objects.select_for_update().get(pk=event.gateway_id)
            fresh=WebhookEvent.objects.select_for_update().get(pk=event.pk)
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
            if proof["kind"]=="refund" and proof["state"]=="processed":
                from .refund_authority import record_processed,original_authorized
                if not original_authorized(original,gateway):
                    return "held"
                record_processed(original,proof,event_id=fresh.pk)
            # A confirmed case puts new fulfillment on review; no existing service
            # is remotely suspended, deleted, or refunded automatically.
            original.metadata={**original.metadata,"financial_exception_review_required":True}
            original.metadata.pop("financial_exception_closure_v1",None)
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


def verify_late_payment(event,intent):
    """Preserve independent proof of late money without granting settlement."""
    from .readback import REFERENCE
    from .domain_pilot_scope import is_pilot_invoice
    if (not event.is_verified or event.is_processed or event.event_type!="charge.success"
            or event.gateway.code!="paystack" or event.gateway.test_mode or event.gateway.status!="active"
            or event.gateway_id!=intent.gateway_id or is_pilot_invoice(intent.invoice)
            or not (intent.is_expired() or intent.status in ("expired","failed"))
            or intent.status=="completed" or not REFERENCE.fullmatch(intent.reference)
            or event.payload.get("intent_id")!=intent.pk or event.payload.get("reference")!=intent.reference
            or event.payload.get("binding")!=intent.gateway.config or event.payload.get("mode")!="live"
            or intent.metadata.get("payment_mode")!="live"
            or intent.metadata.get("gateway_binding")!=intent.gateway.config):
        return "held"
    if event.payload.get("late_payment_review"):
        return "held"
    try:
        remote=numeric_id(event.payload.get("remote_id"))
        data=_read("transaction/verify/"+intent.reference,resolve_live_key(intent.gateway))
        minor=data.get("amount") if isinstance(data,dict) else None
        if (not isinstance(data,dict) or data.get("domain")!="live" or data.get("status")!="success"
                or data.get("reference")!=intent.reference or numeric_id(data.get("id"))!=remote
                or type(minor) is not int or not 0<minor<=999999999999
                or data.get("currency")!=intent.currency or Decimal(minor)/100!=intent.amount):
            return "held"
        with transaction.atomic():
            locked=PaymentIntent.objects.select_for_update().get(pk=intent.pk)
            gateway=PaymentGateway.objects.select_for_update().get(pk=event.gateway_id)
            fresh=WebhookEvent.objects.select_for_update().get(pk=event.pk)
            if (fresh.is_processed or fresh.payload!=event.payload or locked.reference!=intent.reference
                    or locked.amount!=intent.amount or locked.currency!=intent.currency
                    or locked.gateway_id!=gateway.pk or locked.metadata!=intent.metadata
                    or locked.status=="completed" or not (locked.is_expired() or locked.status in ("expired","failed"))
                    or gateway.config!=intent.gateway.config or not resolve_live_key(gateway)):
                return "held"
            proof={"kind":"late_payment","case_id":remote,"state":"verified_review_required",
                   "amount_minor":minor,"currency":intent.currency}
            AuditLog.objects.create(actor=None,action="late_payment_verified",entity_type="PaymentIntent",
                entity_id=str(locked.pk),entity_name="Paystack late payment exception",
                details={**proof,"event_id":fresh.pk,"invoice_id":locked.invoice_id,"review_required":True})
            fresh.payload={**fresh.payload,"late_payment_review":True,"verified_case":proof}
            fresh.save(update_fields=["payload"])
        return "held"
    except (ExceptionRefused,DatabaseError,KeyError,TypeError,ValueError,PaymentIntent.DoesNotExist,
            PaymentGateway.DoesNotExist,WebhookEvent.DoesNotExist):
        return "held"
