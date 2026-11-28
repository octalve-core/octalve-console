"""Explicit MFA-authorized Paystack refund requests and independent reversal ledger.

Original collection is gross historical evidence, not a net balance. A refund
does not reopen an invoice or create a service entitlement. Unknown POST results
are never retried automatically; readback is the only recovery path.
"""
import re
import uuid
from decimal import Decimal
import requests
from django.db import transaction,DatabaseError
from django.db.models import Sum
from django.utils import timezone
from django.views.decorators.debug import sensitive_variables
from audit.models import AuditLog
from .models import Transaction,PaymentGateway,PaymentIntent,WebhookEvent
from .live_binding import resolve_live_key
from .financial_exceptions import ExceptionRefused,numeric_id,remote_transaction,_read,fetch_case

KEY="paystack_refund_request_v1"
REF=re.compile(r"^OCRF[0-9a-f]{32}$")
STATES=("pending","processing","processed","failed","needs-attention")

def original_authorized(original,gateway):
    if not isinstance(original.metadata,dict):
        return False
    return (original.gateway_id==gateway.pk and original.transaction_type=="payment"
        and original.status=="successful" and original.currency=="NGN" and original.invoice_id
        and original.metadata.get("payment_mode")=="live"
        and original.metadata.get("provider_api_verified") is True
        and original.metadata.get("verified_remote_id")==original.provider_reference
        and original.webhook_verified and PaymentIntent.objects.filter(reference=original.reference,
            invoice_id=original.invoice_id,client_id=original.client_id,gateway=gateway,status="completed",
            amount=original.amount,currency=original.currency,metadata__payment_mode="live",
            metadata__gateway_binding=gateway.config).exists()
        and WebhookEvent.objects.filter(pk=original.metadata.get("signed_event_id"),gateway=gateway,
            is_verified=True,is_processed=True,event_type="charge.success",payload__reference=original.reference,
            payload__remote_id=original.provider_reference,payload__binding=gateway.config,payload__mode="live").exists())

def refund_rows(original):
    return Transaction.objects.filter(gateway_id=original.gateway_id,transaction_type="refund",
        metadata__original_payment_id=original.pk,status="successful")

def total_refunded(original):
    return refund_rows(original).aggregate(total=Sum("amount"))["total"] or Decimal("0")

def record_processed(original,proof,*,event_id=None):
    """Caller must hold the original payment row and gateway lock."""
    if not transaction.get_connection().in_atomic_block:
        raise ExceptionRefused("Refund ledger requires a transaction.")
    if (proof["kind"]!="refund" or proof["state"]!="processed" or proof["currency"]!=original.currency
        or proof["transaction_id"]!=original.provider_reference or type(proof["amount_minor"]) is not int
        or proof["amount_minor"]<=0):
        raise ExceptionRefused("Refund proof does not establish money movement.")
    case=numeric_id(proof["case_id"])
    amount=Decimal(proof["amount_minor"])/100
    reference=f"PSREF_{original.gateway_id}_{case}"
    prior=Transaction.objects.filter(reference=reference).first()
    if prior:
        if (prior.transaction_type!="refund" or prior.status!="successful" or prior.amount!=amount
            or prior.currency!=original.currency or prior.gateway_id!=original.gateway_id
            or prior.invoice_id!=original.invoice_id or prior.client_id!=original.client_id
            or prior.metadata.get("original_payment_id")!=original.pk):
            raise ExceptionRefused("Conflicting refund ledger identity.")
        return prior
    if total_refunded(original)+amount>original.amount:
        raise ExceptionRefused("Cumulative refund exceeds original collection.")
    row=Transaction.objects.create(client_id=original.client_id,invoice_id=original.invoice_id,
        gateway_id=original.gateway_id,reference=reference,provider_reference="refund:"+case,
        transaction_type="refund",status="successful",currency=original.currency,
        amount=amount,fee=0,net_amount=-amount,paid_at=timezone.now(),webhook_verified=event_id is not None,
        metadata={"original_payment_id":original.pk,"provider_api_verified":True,
                  "provider_refund_id":case,"signed_event_id":event_id})
    AuditLog.objects.create(actor=None,action="refund_ledger_recorded",entity_type="Transaction",
        entity_id=str(row.pk),entity_name="Paystack refund ledger",details={"original_payment_id":original.pk,
        "refund_id":case,"amount_minor":proof["amount_minor"],"currency":original.currency})
    return row

def remote_disputes(original,key):
    rows=_read("dispute/transaction/"+numeric_id(original.provider_reference),key)
    if not isinstance(rows,list) or len(rows)>=50:
        raise ExceptionRefused("Dispute inventory unavailable.")
    if any(not isinstance(x,dict) or x.get("domain")!="live" or remote_transaction(x.get("transaction"))!=original.provider_reference for x in rows):
        raise ExceptionRefused("Dispute inventory identity mismatch.")
    return rows

def remote_refunds(original,key):
    rows=_read("refund",key,{"transaction":numeric_id(original.provider_reference),"perPage":50,"page":1})
    if not isinstance(rows,list) or len(rows)>=50:
        raise ExceptionRefused("Refund inventory unavailable or too large.")
    result=[]
    seen=set()
    for row in rows:
        if (not isinstance(row,dict) or row.get("domain")!="live"
            or remote_transaction(row.get("transaction"))!=original.provider_reference
            or row.get("currency")!=original.currency or type(row.get("amount")) is not int
            or row["amount"]<=0 or row["status"] not in STATES):
            raise ExceptionRefused("Unrecognized refund inventory.")
        ident=numeric_id(row.get("id"))
        if ident in seen:
            raise ExceptionRefused("Duplicate refund inventory.")
        seen.add(ident)
        result.append({"id":ident,"amount_minor":row["amount"],"state":row["status"],
            "reference":row.get("refund_reference") or row.get("reference")})
    return result

@sensitive_variables("key")
def submit(original,key,entry):
    """Single bounded POST after committed authorization, no redirect or retry."""
    if not REF.fullmatch(entry["reference"]):
        raise ExceptionRefused("Invalid refund reference.")
    with requests.Session() as session:
        session.trust_env=False
        try:
            with session.post("https://api.paystack.co/refund",
                json={"transaction":original.reference,"amount":entry["amount_minor"],
                      "currency":original.currency,"reference":entry["reference"]},
                headers={"Authorization":"Bearer "+key,"Accept":"application/json"},
                timeout=(3,8),allow_redirects=False,verify=True,stream=True) as response:
                if response.status_code not in (200,201,202):
                    raise ExceptionRefused("Refund submission requires reconciliation.")
                import json
                raw=bytearray()
                for chunk in response.iter_content(4096):
                    raw.extend(chunk)
                    if len(raw)>131072:
                        raise ExceptionRefused("Refund response too large.")
                packet=json.loads(raw)
                if not isinstance(packet,dict) or packet.get("status") is not True or not isinstance(packet.get("data"),dict):
                    raise ExceptionRefused("Refund response unconfirmed.")
                data=packet["data"]
                if (remote_transaction(data.get("transaction"))!=original.provider_reference
                    or data.get("amount")!=entry["amount_minor"] or data.get("currency")!=original.currency):
                    raise ExceptionRefused("Refund response identity mismatch.")
                return numeric_id(data["id"]) if data.get("id") is not None else None
        except (requests.RequestException,ValueError,TypeError,KeyError):
            raise ExceptionRefused("Refund submission requires reconciliation.") from None

def request_refund(user,public_id,amount_minor,password,totp):
    from .live_reconciliation import enabled
    from providers.connection_stepup import check_mutation
    if not enabled() or type(amount_minor) is not int or not 0<amount_minor<=999999999999:
        raise ExceptionRefused("Refund amount or live authority unavailable.")
    try:
        original=Transaction.objects.select_related("gateway").get(public_id=uuid.UUID(str(public_id)),transaction_type="payment")
        if not original.gateway or not original_authorized(original,original.gateway):
            raise ExceptionRefused("Verified live collection required.")
        check_mutation(user,password,totp)
        key=resolve_live_key(original.gateway)
        if not key:
            raise ExceptionRefused("Live gateway unavailable.")
        inventory=remote_refunds(original,key)
        if remote_disputes(original,key):
            raise ExceptionRefused("A dispute requires independent review before refund.")
        # Require every prior nonfailed remote case to be recorded and terminal.
        verified=[x for x in inventory if x["state"]=="processed"]
        if any(x["state"] not in ("processed","failed") for x in inventory):
            raise ExceptionRefused("An existing refund is unresolved.")
        with transaction.atomic():
            gateway=PaymentGateway.objects.select_for_update().get(pk=original.gateway_id)
            locked=Transaction.objects.select_for_update().get(pk=original.pk)
            if (gateway.config!=original.gateway.config or not resolve_live_key(gateway)
                or not original_authorized(locked,gateway) or locked.metadata.get(KEY,{}).get("state") in ("uncertain","submitted")
                or locked.metadata.get("paystack_dispute_request_v1")):
                raise ExceptionRefused("Existing payment exception requires review.")
            from domains.models import Domain
            if Domain.objects.filter(order_item__order_id=locked.invoice.order_id,
                metadata__live_domain_registration_v1__state="uncertain").exists() or Domain.objects.filter(metadata__registrar_renewal_v1__invoice=locked.invoice_id,metadata__registrar_renewal_v1__state="uncertain").exists():
                raise ExceptionRefused("Registrar dispatch outcome is unresolved.")
            local={x.metadata.get("provider_refund_id"):int(x.amount*100) for x in refund_rows(locked)}
            if (locked.metadata.get("financial_exception_review_required") is True and not local
                and locked.metadata.get(KEY,{}).get("state")!="failed"):
                raise ExceptionRefused("Existing financial review is unresolved.")
            if local!={x["id"]:x["amount_minor"] for x in verified} or total_refunded(locked)+Decimal(amount_minor)/100>locked.amount:
                raise ExceptionRefused("Refund balance requires reconciliation.")
            entry={"reference":"OCRF"+uuid.uuid4().hex,"amount_minor":amount_minor,
                   "state":"uncertain","binding":gateway.config,"created_at":timezone.now().isoformat()}
            locked.metadata={**locked.metadata,KEY:entry,"financial_exception_review_required":True}
            locked.save(update_fields=["metadata","updated_at"])
            AuditLog.objects.create(actor=user,action="refund_authorized",entity_type="Transaction",
                entity_id=str(locked.pk),entity_name="Paystack refund authorization",
                details={"reference":entry["reference"],"amount_minor":amount_minor,"currency":locked.currency})
        # Reservation is committed before external POST. Recheck credential.
        current=PaymentGateway.objects.get(pk=original.gateway_id)
        if current.config!=entry["binding"] or resolve_live_key(current)!=key:
            return {"reference":entry["reference"],"state":"uncertain"}
        try:
            remote=submit(original,key,entry)
        except ExceptionRefused:
            return {"reference":entry["reference"],"state":"uncertain"}
        with transaction.atomic():
            locked=Transaction.objects.select_for_update().get(pk=original.pk)
            if locked.metadata.get(KEY)==entry:
                locked.metadata={**locked.metadata,KEY:{**entry,"state":"submitted","remote_id":remote}}
                locked.save(update_fields=["metadata","updated_at"])
        return {"reference":entry["reference"],"state":"submitted"}
    except (Transaction.DoesNotExist,PaymentGateway.DoesNotExist,ValueError,TypeError,KeyError,DatabaseError):
        raise ExceptionRefused("Refund request could not be qualified. Review existing cases before retrying.") from None

def reconcile_request(original_id):
    try:
        original=Transaction.objects.select_related("gateway").get(pk=original_id,transaction_type="payment")
        entry=original.metadata[KEY]
        if entry["state"] not in ("uncertain","submitted") or not REF.fullmatch(entry["reference"]):
            return "held"
        key=resolve_live_key(original.gateway)
        if not key or entry["binding"]!=original.gateway.config or not original_authorized(original,original.gateway):
            return "held"
        candidates=[x for x in remote_refunds(original,key) if x["amount_minor"]==entry["amount_minor"]
            and (x["reference"]==entry["reference"] or (entry.get("remote_id") and x["id"]==entry["remote_id"]))]
        if len(candidates)!=1:
            return "held"
        candidate=candidates[0]
        data=fetch_case("refund",candidate["id"],key)
        if (data.get("domain")!="live" or numeric_id(data.get("id"))!=candidate["id"]
            or remote_transaction(data.get("transaction"))!=original.provider_reference
            or data.get("currency")!=original.currency or data.get("amount")!=entry["amount_minor"]
            or data.get("status") not in STATES):
            return "held"
        if data["status"] not in ("processed","failed"):
            return "held"
        with transaction.atomic():
            gateway=PaymentGateway.objects.select_for_update().get(pk=original.gateway_id)
            locked=Transaction.objects.select_for_update().get(pk=original.pk)
            if locked.metadata.get(KEY)!=entry or gateway.config!=entry["binding"] or not resolve_live_key(gateway):
                return "held"
            if data["status"]=="processed":
                record_processed(locked,{"kind":"refund","state":"processed","currency":locked.currency,
                    "transaction_id":locked.provider_reference,"case_id":candidate["id"],"amount_minor":entry["amount_minor"]})
            locked.metadata={**locked.metadata,KEY:{**entry,"state":data["status"],"remote_id":candidate["id"]}}
            locked.save(update_fields=["metadata","updated_at"])
            AuditLog.objects.create(actor=None,action="refund_request_reconciled",entity_type="Transaction",
                entity_id=str(locked.pk),entity_name="Paystack refund reconciliation",
                details={"reference":entry["reference"],"refund_id":candidate["id"],"state":data["status"]})
        return "processed"
    except (ExceptionRefused,DatabaseError,KeyError,TypeError,ValueError,Transaction.DoesNotExist,PaymentGateway.DoesNotExist):
        return "held"
