"""Customer-owned test domains and isolated DNS editing, never live DNS.

Projection of verified test invoices and original order items; no commercial
Domain, DNSRecord, Service, transaction, zone, or registrar mutation.
"""
import ipaddress
import re
from uuid import uuid4
from django.db import transaction
from django.db.models import Q, CharField
from django.db.models.fields.json import KeyTextTransform
from django.db.models.functions import Cast
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import NotFound, ValidationError, Throttled
from rest_framework.response import Response
from accounts.security_throttle import _spend
from billing.models import Invoice
from orders.models import Order, OrderItem
from payments.models import WebhookEvent
from payments.customer_test_evidence import test_payment_evidence
from payments.domain_pilot_scope import CART, PILOT
from payments.automatic_reconciliation import enabled, attempt_event
from providers.cloudflare_int01 import DOMAIN

KEY="sandbox_dns_workspace_v1"
MAX_RECORDS=100
TYPES=("A","AAAA","CNAME","MX","TXT")
LABEL=re.compile(r"^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$")
HOST=re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")

def guard(user):
    if not enabled() or not user.is_active or user.role!="client" or not user.email_verified_at:
        raise NotFound()

def invoices(user):
    return Invoice.objects.filter(client=user,order__client=user,status="void",
        order__status="needs_review").filter(Q(metadata__combined_domain_test_cart=True) |
            Q(metadata__sandbox_domain_purchase=True)).select_related("order")

def eligible_line(invoice,line):
    order=invoice.order
    if line.order_id!=order.pk or line.item_type!="domain" or not isinstance(line.domain_name,str) or not DOMAIN.fullmatch(line.domain_name):
        return False
    if invoice.metadata.get(PILOT) is True:
        return order.metadata.get(PILOT,{}).get("domain")==line.domain_name
    state=order.metadata.get(CART,{})
    return isinstance(state,dict) and isinstance(state.get("domains"),list) and line.domain_name in state["domains"]

def workspace(invoice,line,proof):
    order=invoice.order
    if not eligible_line(invoice,line):
        return None
    rehearsal=order.metadata.get("test_lifecycle_v1",{})
    refunded=isinstance(rehearsal,dict) and rehearsal.get("refund",{}).get("status")=="simulated_refund"
    state=order.metadata[PILOT] if invoice.metadata.get(PILOT) is True else line.config.get(CART,{})
    registration=state.get("registration",{}) if isinstance(state,dict) else {}
    if not isinstance(registration,dict):
        registration={}
    supplier_confirmed=bool(isinstance(state,dict) and state.get("state")=="registered"
        and registration.get("domain_name")==line.domain_name and registration.get("sandbox_status")=="active")
    records=order.metadata.get(KEY,{}).get(str(line.pk),[])
    return {"id":line.pk,"domain":line.domain_name,"invoice_reference":invoice.public_reference,
        "mode":"sandbox","payment_verified":bool(proof),"state":"cancelled" if refunded else "active" if proof else "verifying_payment",
        "registration":"supplier_sandbox_confirmed" if supplier_confirmed else "not_confirmed",
        "registered_at":registration.get("registered_at") if supplier_confirmed else None,
        "expires_at":registration.get("expires_at") if supplier_confirmed else None,
        "term_months":line.months,"dns_editable":bool(proof and not refunded),
        "live_dns":False,"records":records if proof and not refunded else []}

def listing(user):
    rows=[]
    for invoice in invoices(user).order_by("-pk")[:50]:
        proof=test_payment_evidence(invoice)
        for line in invoice.order.items.filter(item_type="domain").order_by("pk")[:20]:
            result=workspace(invoice,line,proof)
            if result:
                rows.append(result)
    return rows

def validate_record(raw):
    if not isinstance(raw,dict) or set(raw)!={"type","name","value","ttl","priority"}:
        raise ValidationError("Provide type, host, value, TTL and priority.")
    kind,name,value,ttl,priority=(raw[k] for k in ("type","name","value","ttl","priority"))
    if kind not in TYPES or not isinstance(name,str) or not isinstance(value,str) or not 1<=len(value)<=2048 or type(ttl) is not int or not 60<=ttl<=86400:
        raise ValidationError("Invalid DNS type, value or TTL.")
    name=name.lower().strip()
    if name!="@" and (not 1<=len(name)<=253 or not all(LABEL.fullmatch(part) or (index==0 and part=="*") for index,part in enumerate(name.split(".")))):
        raise ValidationError("Use @ or a relative host name.")
    if any(ord(ch)<32 or ord(ch)==127 for ch in value):
        raise ValidationError("Control characters are not allowed.")
    if kind in ("A","AAAA"):
        try:
            ip=ipaddress.ip_address(value)
            if ip.version!=(4 if kind=="A" else 6) or "%" in value:
                raise ValueError()
            value=str(ip)
        except ValueError:
            raise ValidationError("Enter a valid IP address.") from None
    elif kind in ("MX","CNAME"):
        value=value.lower().rstrip(".")
        if len(value)>253 or not HOST.fullmatch(value) or (kind=="CNAME" and name=="@"):
            raise ValidationError("Enter a valid target hostname; apex CNAME is not supported.")
    if kind=="MX":
        if type(priority) is not int or not 0<=priority<=65535:
            raise ValidationError("MX priority must be between 0 and 65535.")
    elif priority is not None:
        raise ValidationError("Priority applies only to MX records.")
    return {"type":kind,"name":name,"value":value,"ttl":ttl,"priority":priority}

def validate_rrset(records,new,exclude=None):
    for row in records:
        if row["id"]==exclude or row["name"]!=new["name"]:
            continue
        if row["type"]=="CNAME" or new["type"]=="CNAME":
            raise ValidationError("CNAME cannot share a host with other records.")
        if (row["type"],row["value"],row["priority"])==(new["type"],new["value"],new["priority"]):
            raise ValidationError("This DNS record already exists.")

@api_view(["GET","POST"])
@permission_classes([IsAuthenticated])
def sandbox_domains(request):
    guard(request.user)
    if request.method=="POST":
        if request.data!={"action":"sync"}:
            raise ValidationError("Unsupported synchronization request.")
        # Owner-scoped retry when the customer opens My Domains. No supplier
        # call; at most two historical readbacks per five-minute interval.
        wait=_spend("sandbox:domain_sync",str(request.user.pk),1,300)
        if not wait:
            from payments.models import PaymentIntent
            ids=[str(pk) for pk in PaymentIntent.objects.filter(invoice__in=invoices(request.user),status="completed",
                gateway__code="paystack",gateway__test_mode=True).order_by("-pk").values_list("pk",flat=True)[:100]]
            from django.db.models import F
            candidates=WebhookEvent.objects.filter(is_verified=True,is_processed=False,
                gateway__code="paystack",gateway__test_mode=True,event_type="charge.success",
                ).annotate(intent_key=Cast(KeyTextTransform("intent_id","payload"),CharField())).filter(
                intent_key__in=ids).order_by(F("error_message").asc(nulls_first=True),"pk")[:2]
            for event in candidates:
                attempt_event(event.pk)
    return Response({"mode":"sandbox","domains":listing(request.user)},headers={"Cache-Control":"private, no-store"})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def sandbox_dns(request,item_id):
    guard(request.user)
    wait=_spend("sandbox:dns_edit",str(request.user.pk),60,300)
    if wait:
        raise Throttled(wait=wait)
    data=request.data
    if not isinstance(data,dict) or data.get("action") not in ("create","update","delete"):
        raise ValidationError("Invalid DNS operation.")
    action=data["action"]
    expected={"action","record"} if action=="create" else {"action","id"} if action=="delete" else {"action","id","record"}
    if set(data)!=expected:
        raise ValidationError("Invalid DNS operation.")
    with transaction.atomic():
        line=get_object_or_404(OrderItem,item_type="domain",pk=item_id,order__client=request.user)
        rows=list(invoices(request.user).select_for_update(of=("self",)).filter(order_id=line.order_id)[:2])
        if len(rows)!=1:
            raise NotFound()
        invoice=rows[0]
        order=Order.objects.select_for_update().get(pk=line.order_id,client=request.user)
        invoice.order=order
        proof=test_payment_evidence(invoice)
        result=workspace(invoice,line,proof)
        if not result or not result["dns_editable"]:
            raise NotFound()
        records=list(result["records"])
        if action=="create":
            if len(records)>=MAX_RECORDS:
                raise ValidationError("Sandbox DNS record limit reached.")
            new=validate_record(data["record"])
            validate_rrset(records,new)
            records.append({"id":str(uuid4()),**new})
        else:
            index=next((i for i,r in enumerate(records) if r["id"]==data["id"]),None)
            if index is None:
                raise NotFound()
            if action=="delete":
                records.pop(index)
            else:
                new=validate_record(data["record"])
                validate_rrset(records,new,exclude=data["id"])
                records[index]={"id":data["id"],**new}
        order.metadata.setdefault(KEY,{})[str(line.pk)]=records
        order.save(update_fields=["metadata","updated_at"])
        result["records"]=records
    return Response(result,headers={"Cache-Control":"private, no-store"})
