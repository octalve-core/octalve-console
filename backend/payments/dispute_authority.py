"""MFA-authorized dispute response; independent status confirmation.

Evidence bytes are forwarded only to Paystack's documented S3 upload host.
Unknown resolution results are never resubmitted automatically.
"""
import re
import json
import requests
from urllib.parse import urlsplit
from django.db import transaction,DatabaseError
from django.utils import timezone
from django.views.decorators.debug import sensitive_variables
from audit.models import AuditLog
from .models import Transaction,PaymentGateway,WebhookEvent
from .financial_exceptions import ExceptionRefused,numeric_id,remote_transaction,fetch_case,_read
from .refund_authority import original_authorized,remote_refunds,total_refunded,KEY as REFUND_KEY
from .live_binding import resolve_live_key

KEY="paystack_dispute_request_v1"

@sensitive_variables("key")
def provider_write(method,path,key,body):
    if not re.fullmatch(r"dispute/[0-9]{1,35}/(?:resolve|evidence)",path) or method not in ("PUT","POST"):
        raise ExceptionRefused("Unsupported dispute operation.")
    with requests.Session() as session:
        session.trust_env=False
        try:
            with session.request(method,"https://api.paystack.co/"+path,json=body,
                headers={"Authorization":"Bearer "+key,"Accept":"application/json"},timeout=(3,8),
                allow_redirects=False,verify=True,stream=True) as response:
                if response.status_code not in (200,201,202):
                    raise ExceptionRefused("Dispute operation requires review.")
                raw=bytearray()
                for chunk in response.iter_content(4096):
                    raw.extend(chunk)
                    if len(raw)>131072:
                        raise ExceptionRefused("Dispute response too large.")
                packet=json.loads(raw)
                if not isinstance(packet,dict) or packet.get("status") is not True or not isinstance(packet.get("data"),dict):
                    raise ExceptionRefused("Dispute response unconfirmed.")
                return packet["data"]
        except (requests.RequestException,ValueError,TypeError):
            raise ExceptionRefused("Dispute operation requires review.") from None

@sensitive_variables("key","url","receipt")
def upload_receipt(case,key,receipt):
    if not receipt or receipt.size>3*1024*1024 or receipt.size<8:
        raise ExceptionRefused("Supply a PDF or JPEG receipt up to 3 MB.")
    content=receipt.read()
    if content.startswith(b"%PDF-"):
        mime,extension="application/pdf","pdf"
    elif content.startswith(b"\xff\xd8\xff"):
        mime,extension="image/jpeg","jpg"
    else:
        raise ExceptionRefused("Unrecognized receipt format.")
    filename="octalve-dispute-"+case+"."+extension
    data=_read("dispute/"+case+"/upload_url",key,{"upload_filename":filename})
    if not isinstance(data,dict) or not isinstance(data.get("signedUrl"),str) or not isinstance(data.get("fileName"),str):
        raise ExceptionRefused("Evidence upload unavailable.")
    url=data["signedUrl"]
    name=data["fileName"]
    if len(url)>8192 or not re.fullmatch(r"[A-Za-z0-9_.-]{1,200}",name):
        raise ExceptionRefused("Invalid evidence destination.")
    parsed=urlsplit(url)
    if (parsed.scheme!="https" or parsed.netloc!="s3.eu-west-1.amazonaws.com"
        or not parsed.path.startswith("/files.paystack.co/") or parsed.fragment
        or not parsed.query or "/../" in parsed.path):
        raise ExceptionRefused("Unapproved evidence destination.")
    with requests.Session() as session:
        session.trust_env=False
        try:
            with session.put(url,data=content,headers={"Content-Type":mime},
                timeout=(3,12),allow_redirects=False,verify=True,stream=True) as response:
                if response.status_code not in (200,201,204):
                    raise ExceptionRefused("Evidence upload uncertain.")
        except requests.RequestException:
            raise ExceptionRefused("Evidence upload uncertain.") from None
    return name

def validate_dispute(data,case,original):
    if (not isinstance(data,dict) or data.get("domain")!="live" or numeric_id(data.get("id"))!=case
        or remote_transaction(data.get("transaction"))!=original.provider_reference
        or data.get("currency")!=original.currency):
        raise ExceptionRefused("Dispute identity mismatch.")
    return data

def resolve(user,event_id,resolution,amount_minor,message,password,totp,receipt=None,service_details=""):
    from .live_reconciliation import enabled
    from providers.connection_stepup import check_mutation
    if (not enabled() or resolution not in ("merchant-accepted","declined")
        or type(amount_minor) is not int or not 0<=amount_minor<=999999999999
        or not isinstance(message,str) or not 1<=len(message.strip())<=500
        or not isinstance(service_details,str) or len(service_details)>2000
        or (resolution=="declined" and (amount_minor!=0 or not receipt))
        or (resolution=="merchant-accepted" and (amount_minor<=0 or receipt))):
        raise ExceptionRefused("Confirm the exact dispute resolution and evidence.")
    event=WebhookEvent.objects.select_related("gateway").get(pk=event_id,is_verified=True,is_processed=True,event_type__in=("charge.dispute.create","charge.dispute.remind","charge.dispute.resolve"))
    proof=event.payload.get("verified_case") or {}
    case=numeric_id(proof.get("case_id"))
    gateway=event.gateway
    if event.payload.get("binding")!=gateway.config:
        raise ExceptionRefused("Dispute authority changed.")
    original=Transaction.objects.get(gateway=gateway,transaction_type="payment",provider_reference=proof.get("transaction_id"),status="successful")
    check_mutation(user,password,totp)
    key=resolve_live_key(gateway)
    if not key or not original_authorized(original,gateway):
        raise ExceptionRefused("Verified live payment required.")
    data=validate_dispute(fetch_case("dispute",case,key),case,original)
    if data.get("status")!="awaiting-merchant-feedback":
        raise ExceptionRefused("Dispute is no longer awaiting merchant feedback.")
    inventory=remote_refunds(original,key)
    if any(x["state"] not in ("processed","failed") for x in inventory):
        raise ExceptionRefused("Existing refund is unresolved.")
    used=sum(x["amount_minor"] for x in inventory if x["state"]=="processed")
    if used+amount_minor>int(original.amount*100):
        raise ExceptionRefused("Dispute amount exceeds available collection.")
    if resolution=="merchant-accepted" and type(data.get("refund_amount")) is int and data["refund_amount"]>0 and amount_minor>data["refund_amount"]:
        raise ExceptionRefused("Amount exceeds the disputed amount.")
    if resolution=="declined" and data.get("category")=="fraud" and not service_details.strip():
        raise ExceptionRefused("Fraud claim requires factual service evidence.")
    with transaction.atomic():
        gateway=PaymentGateway.objects.select_for_update().get(pk=gateway.pk)
        locked=Transaction.objects.select_for_update().get(pk=original.pk)
        if (not original_authorized(locked,gateway) or resolve_live_key(gateway)!=key
            or locked.metadata.get(REFUND_KEY,{}).get("state") in ("submitted","uncertain")
            or locked.metadata.get(KEY)):
            raise ExceptionRefused("Another financial operation is unresolved.")
        from domains.models import Domain
        if resolution=="merchant-accepted" and (Domain.objects.filter(order_item__order_id=locked.invoice.order_id,metadata__live_domain_registration_v1__state="uncertain").exists() or Domain.objects.filter(metadata__registrar_renewal_v1__invoice=locked.invoice_id,metadata__registrar_renewal_v1__state="uncertain").exists()):
            raise ExceptionRefused("A registrar operation is unresolved.")
        entry={"case_id":case,"resolution":resolution,"amount_minor":amount_minor,
            "binding":gateway.config,"state":"uncertain","created_at":timezone.now().isoformat()}
        locked.metadata={**locked.metadata,KEY:entry,"financial_exception_review_required":True}
        locked.save(update_fields=["metadata","updated_at"])
        AuditLog.objects.create(actor=user,action="dispute_resolution_authorized",entity_type="Transaction",
            entity_id=str(locked.pk),entity_name="Paystack dispute",details={"case_id":case,"resolution":resolution,"amount_minor":amount_minor})
    try:
        if resolve_live_key(PaymentGateway.objects.get(pk=gateway.pk))!=key:
            return {"case_id":case,"state":"uncertain"}
        body={"resolution":resolution,"message":message.strip(),"refund_amount":amount_minor}
        if resolution=="declined":
            body["uploaded_filename"]=upload_receipt(case,key,receipt)
            if data.get("category")=="fraud":
                contact=original.invoice.metadata.get("billing_contact",{})
                evidence={"customer_email":contact.get("email"),"customer_name":contact.get("full_name"),
                    "customer_phone":contact.get("phone_number"),"service_details":service_details.strip()}
                if any(not isinstance(x,str) or not x.strip() for x in evidence.values()):
                    raise ExceptionRefused("Original billing contact incomplete.")
                answer=provider_write("POST","dispute/"+case+"/evidence",key,evidence)
                if numeric_id(answer.get("dispute"))!=case:
                    raise ExceptionRefused("Evidence identity mismatch.")
                body["evidence"]=int(numeric_id(answer.get("id")))
        provider_write("PUT","dispute/"+case+"/resolve",key,body)
    except ExceptionRefused:
        return {"case_id":case,"state":"uncertain"}
    return {"case_id":case,"state":"submitted" if reconcile(original.pk)=="processed" else "uncertain"}

def reconcile(original_id):
    try:
        original=Transaction.objects.select_related("gateway").get(pk=original_id)
        entry=original.metadata[KEY]
        if entry["state"]!="uncertain":
            return "held"
        key=resolve_live_key(original.gateway)
        if not key or entry["binding"]!=original.gateway.config or not original_authorized(original,original.gateway):
            return "held"
        case=numeric_id(entry["case_id"])
        data=validate_dispute(fetch_case("dispute",case,key),case,original)
        if (data.get("status")!="resolved" or data.get("resolution")!=entry["resolution"]
            or (entry["resolution"]=="merchant-accepted" and data.get("refund_amount")!=entry["amount_minor"])):
            return "held"
        with transaction.atomic():
            gateway=PaymentGateway.objects.select_for_update().get(pk=original.gateway_id)
            locked=Transaction.objects.select_for_update().get(pk=original.pk)
            if locked.metadata.get(KEY)!=entry or resolve_live_key(gateway)!=key or gateway.config!=entry["binding"]:
                return "held"
            locked.metadata={**locked.metadata,KEY:{**entry,"state":"resolved"}}
            locked.save(update_fields=["metadata","updated_at"])
            AuditLog.objects.create(actor=None,action="dispute_resolution_verified",entity_type="Transaction",
                entity_id=str(locked.pk),entity_name="Paystack dispute",details={"case_id":case,"resolution":entry["resolution"],"amount_minor":entry["amount_minor"]})
        # Resolution is NOT cash movement. Only independently processed refund
        # events may record a reversal; retain financial review protection.
        return "processed"
    except (ExceptionRefused,DatabaseError,KeyError,TypeError,ValueError,Transaction.DoesNotExist,PaymentGateway.DoesNotExist):
        return "held"
