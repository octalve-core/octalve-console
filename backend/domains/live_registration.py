"""One-year Cloudflare live registration: quote, customer claim, paid fulfillment.

Uses the existing checkout and independently verified ledger. A durable
uncertainty fence precedes the supplier request. No blind resubmission.
"""
from decimal import Decimal,InvalidOperation
from datetime import timedelta
import re
import hashlib
import json
from uuid import UUID
from django.conf import settings
from django.core import signing
from django.db import transaction,DatabaseError
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from dateutil.relativedelta import relativedelta
from rest_framework.decorators import api_view,permission_classes,throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError,NotFound
from rest_framework.response import Response
from audit.models import AuditLog
from billing.models import Invoice
from billing.contact import billing_contact_snapshot
from orders.models import Order,OrderItem
from payments.models import PaymentGateway,Transaction
from payments.live_binding import resolve_live_key
from provisioning.authority import require_verified_settlement,SettlementNotVerified
from providers.registrar_live_policy import ready,load
from providers.registrar_live_transport import request as registrar_request
from providers.cloudflare_int01 import CloudflareINT01,FixedCloudflareTransport,CloudflareINT01Denied,require_domain
from providers.connection_models import IntegrationConnection,IntegrationCredentialVersion
from providers.connection_vault import VaultUnavailable
from .models import Domain,TLDPricing
from .pilot import DomainPurchaseThrottle

KEY="live_domain_registration_v1"
SALT="octalve.live-domain-registration.v1"
HEADERS={"Cache-Control":"private, no-store"}
class RegistrationRefused(ValueError):
    pass

def enabled():
    from payments.live_reconciliation import enabled as payment_enabled
    return bool(ready() and payment_enabled() and settings.CLOUD_HOSTED_CHECKOUT_ENABLED
                and settings.CLOUD_HOSTED_CHECKOUT_HTTP_ENABLED)

def connector(route):
    row,secret=load(route)
    return row,secret,CloudflareINT01(row.public_settings["account_id"],FixedCloudflareTransport(secret))

def cost_snapshot(price,domain):
    route=price.metadata.get("published_registrar")
    cost=price.metadata.get("published_registrar_cost_v1")
    if (price.status!="active" or not isinstance(route,dict) or not isinstance(cost,dict)
        or route.get("revision")!=cost.get("revision") or price.register_price<=0):
        raise RegistrationRefused("Republish verified registrar pricing.")
    row,secret,adapter=connector(route)
    proof=adapter.live_domain_check(domain)
    if (proof.get("name")!=domain or proof.get("registrable") is not True or proof.get("currency")!=cost["currency"]
        or Decimal(proof["registration_cost"])>Decimal(cost["registration_cost"])
        or Decimal(proof["registration_cost"])*Decimal(cost["ngn_per_unit"])>price.register_price):
        raise RegistrationRefused("Availability or supplier price changed.")
    return route,cost,proof

def quote(user,name):
    if not enabled() or user.role!="client" or not user.is_active or not user.email_verified_at:
        raise RegistrationRefused("Verified customer and live checkout required.")
    name=require_domain(name)
    if name.count(".")!=1:
        raise RegistrationRefused("Only registrable .com/.net names are supported.")
    gateway=PaymentGateway.objects.filter(code="paystack",status="active",test_mode=False).first()
    if not gateway or not resolve_live_key(gateway):
        raise RegistrationRefused("Live payment gateway unavailable.")
    if Domain.objects.filter(domain_name__iexact=name).exists():
        raise RegistrationRefused("Domain already has a claim.")
    price=TLDPricing.objects.get(tld="."+name.rsplit(".",1)[1],status="active")
    route,cost,proof=cost_snapshot(price,name)
    grant={"owner":user.pk,"domain":name,"route":route,"cost":cost,"retail":str(price.register_price),
        "supplier_amount":proof["registration_cost"],"currency":"NGN","years":1}
    return {"quote":signing.dumps(grant,salt=SALT),"domain":name,"amount":grant["retail"],"currency":"NGN","years":1}

def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(",",":")).encode()).hexdigest()

def validate_contact(user,data):
    if not isinstance(data,dict) or set(data)!={"name","phone","street","city","state","country_code","postal_code"}:
        raise RegistrationRefused("Complete registrant contact is required.")
    if any(not isinstance(x,str) or x!=x.strip() or not 1<=len(x)<=200 or any(ord(c)<32 for c in x) for x in data.values()):
        raise RegistrationRefused("Invalid contact details.")
    if not re.fullmatch(r"\+[1-9][0-9]{0,2}\.[0-9]{4,14}",data["phone"]) or not re.fullmatch(r"[A-Z]{2}",data["country_code"]):
        raise RegistrationRefused("Use international phone and country code.")
    validate_email(user.email)
    return {"email":user.email,"phone":data["phone"],"postal_info":{"name":data["name"],
        "address":{k:data[k] for k in ("street","city","state","country_code","postal_code")}}}

@transaction.atomic
def accept(user,token,contact):
    if not enabled() or user.role!="client" or not user.is_active or not user.email_verified_at:
        raise RegistrationRefused("Verified customer and live checkout required.")
    if not isinstance(token,str) or len(token)>4096:
        raise RegistrationRefused("Invalid quote.")
    grant=signing.loads(token,salt=SALT,max_age=300)
    name=require_domain(grant["domain"])
    if grant["owner"]!=user.pk or grant["years"]!=1:
        raise RegistrationRefused("Quote ownership mismatch.")
    contact=validate_contact(user,contact)
    price=TLDPricing.objects.select_for_update().get(tld="."+name.rsplit(".",1)[1],status="active")
    if (price.metadata.get("published_registrar")!=grant["route"] or price.metadata.get("published_registrar_cost_v1")!=grant["cost"]
        or str(price.register_price)!=grant["retail"]):
        raise RegistrationRefused("Price changed. Request a new quote.")
    row,_=load(grant["route"])
    prior=Domain.objects.select_for_update().filter(domain_name__iexact=name).first()
    if prior:
        if prior.client_id==user.pk and prior.status=="pending" and prior.order_item_id:
            saved=signing.loads(prior.metadata.get(KEY,{}).get("grant",""),salt=SALT)
            if all(saved.get(k)==v for k,v in grant.items()) and saved.get("contact_digest")==digest(contact):
                invoices=list(Invoice.objects.filter(order_id=prior.order_item.order_id,client=user)[:2])
                if len(invoices)==1:
                    invoice=invoices[0]
                    return {"invoice_id":invoice.pk,"invoice_public_id":str(invoice.public_id),"domain":name,"state":"pending_payment"}
        raise RegistrationRefused("Domain already has an order.")
    order=Order.objects.create(client=user,status="pending_payment",currency="NGN",
        metadata={"billing_contact":billing_contact_snapshot(user)})
    item=OrderItem.objects.create(order=order,item_type="domain",product_id=0,plan_id=0,billing_cycle_id=0,
        domain_name=name,description=name+" registration (1 year)",unit_price=price.register_price,cycle_key="1yr",months=12)
    order.refresh_from_db()
    domain=Domain.objects.create(client=user,domain_name=name,tld=price.tld,order_item=item,registration_type="register",
        registrar="cloudflare-registrar-live",status="pending",is_active=False,registration_date=None,
        auto_renew=False,registrant_contact=contact,metadata={KEY:{"state":"queued","grant":signing.dumps({**grant,"order":order.pk,"item":item.pk,"account_id":row.public_settings["account_id"],"contact_digest":digest(contact)},salt=SALT)}})
    order.metadata={**order.metadata,KEY:{"domain_id":domain.pk,"item":item.pk}}
    order.save(update_fields=["metadata","updated_at"])
    invoice=Invoice.create_from_order(order)
    return {"invoice_id":invoice.pk,"invoice_public_id":str(invoice.public_id),"domain":name,"state":"pending_payment"}

def authority(domain,*,lock=False):
    entry=domain.metadata[KEY]
    grant=signing.loads(entry["grant"],salt=SALT)
    item=domain.order_item
    if (digest(domain.registrant_contact)!=grant.get("contact_digest") or domain.management_kind!="registrar" or domain.registrar!="cloudflare-registrar-live" or domain.status!="pending"
        or not item or item.pk!=grant["item"] or item.order_id!=grant["order"] or item.item_type!="domain"
        or item.domain_name!=domain.domain_name or domain.domain_name!=grant["domain"] or domain.client_id!=grant["owner"]
        or item.order.client_id!=domain.client_id or item.months!=12 or item.quantity!=1 or str(item.subtotal)!=grant["retail"]
        or item.order.metadata.get(KEY)!={"domain_id":domain.pk,"item":item.pk} or item.order.items.count()!=1):
        raise RegistrationRefused("Registration authority changed.")
    invoices=Invoice.objects.filter(order_id=item.order_id,client_id=domain.client_id)
    if lock: invoices=invoices.select_for_update()
    invoices=list(invoices[:2])
    if len(invoices)!=1:
        raise RegistrationRefused("Exactly one invoice required.")
    invoice=invoices[0]
    payments=Transaction.objects.filter(invoice=invoice,transaction_type="payment",status="successful")
    if lock: payments=payments.select_for_update()
    payments=list(payments[:2])
    if len(payments)!=1 or payments[0].gateway.code!="paystack" or not payments[0].webhook_verified or payments[0].metadata.get("payment_mode")!="live":
        raise RegistrationRefused("Verified live Paystack payment required.")
    require_verified_settlement(invoice,payments[0])
    if invoice.total!=item.subtotal or invoice.order.total!=item.subtotal:
        raise RegistrationRefused("Domain invoice changed.")
    return entry,grant,invoice

def transition(domain_id):
    try:
        if not enabled():
            return "held"
        domain=Domain.objects.select_related("order_item__order").get(pk=domain_id)
        entry,grant,invoice=authority(domain)
        row,secret,adapter=connector(grant["route"])
        if row.public_settings["account_id"]!=grant.get("account_id"):
            return "held"
        state=entry["state"]
        if state=="queued":
            proof=adapter.live_domain_check(domain.domain_name)
            if (proof.get("name")!=domain.domain_name or proof.get("registrable") is not True or proof.get("currency")!=grant["cost"]["currency"]
                or Decimal(proof["registration_cost"])>Decimal(grant["supplier_amount"])):
                return "held"
            with transaction.atomic():
                # Invoice -> payment -> domain order is consistent with settlement.
                Invoice.objects.select_for_update().get(pk=invoice.pk)
                locked=Domain.objects.select_for_update().get(pk=domain.pk)
                fresh,g,inv=authority(locked,lock=True)
                IntegrationConnection.objects.select_for_update().get(pk=row.pk)
                if fresh!=entry or g!=grant or load(grant["route"])[1]!=secret:
                    raise RegistrationRefused("Registration authority changed.")
                entry={**entry,"state":"uncertain","reserved_at":timezone.now().isoformat()}
                locked.metadata={**locked.metadata,KEY:entry}
                locked.save(update_fields=["metadata","updated_at"])
                AuditLog.objects.create(actor=None,action="live_domain_registration_reserved",entity_type="Domain",
                    entity_id=str(locked.pk),entity_name=locked.domain_name,details={"order":grant["order"],"connection":str(row.pk)})
            # The uncertain state MUST commit before the external mutation.
            if load(grant["route"])[1]!=secret:
                return "held"
            registrar_request(row.public_settings["account_id"],secret,domain.domain_name,"create",domain.registrant_contact)
        elif state!="uncertain":
            return "held"
        workflow=registrar_request(row.public_settings["account_id"],secret,domain.domain_name,"status")
        if workflow["state"] in ("action_required","failed"):
            with transaction.atomic():
                locked=Domain.objects.select_for_update().get(pk=domain.pk)
                if locked.metadata.get(KEY)==entry:
                    locked.metadata={**locked.metadata,KEY:{**entry,"state":"review","provider_state":workflow["state"]}}
                    locked.save(update_fields=["metadata","updated_at"])
            return "held"
        if workflow["state"]!="succeeded":
            return "held"
        proof=adapter.live_registration_readback(domain.domain_name)
        created=parse_datetime(proof.get("registered_at") or "")
        expires=parse_datetime(proof.get("expires_at") or "")
        reserved=parse_datetime(entry["reserved_at"])
        if (proof.get("status")!="active" or not created or not expires or not reserved
            or created.utcoffset() is None or expires.utcoffset() is None or created<reserved-timedelta(minutes=5)
            or created>timezone.now()+timedelta(minutes=5) or expires<created+relativedelta(years=1)-timedelta(days=1)):
            return "held"
        with transaction.atomic():
            Invoice.objects.select_for_update().get(pk=invoice.pk)
            locked=Domain.objects.select_for_update().get(pk=domain.pk)
            fresh,g,inv=authority(locked,lock=True)
            if fresh!=entry or g!=grant or load(grant["route"])[1]!=secret:
                return "held"
            locked.registration_date=created
            locked.expiry_date=expires
            locked.next_due_date=expires
            locked.status="active"
            locked.is_active=True
            locked.provider_domain_id=locked.domain_name
            locked.metadata={**locked.metadata,KEY:{**entry,"state":"confirmed","confirmed_at":timezone.now().isoformat(),
                "registrant_verification":"supplier_confirmation_required"}}
            locked.save()
            order=Order.objects.select_for_update().get(pk=grant["order"])
            order.mark_provisioned()
            AuditLog.objects.create(actor=None,action="live_domain_registration_confirmed",entity_type="Domain",
                entity_id=str(locked.pk),entity_name=locked.domain_name,details={"order":order.pk,"expires_at":expires.isoformat()})
        return "processed"
    except (RegistrationRefused,SettlementNotVerified,CloudflareINT01Denied,VaultUnavailable,DatabaseError,KeyError,TypeError,ValueError,InvalidOperation,signing.BadSignature,
        Domain.DoesNotExist,IntegrationConnection.DoesNotExist,IntegrationCredentialVersion.DoesNotExist,Invoice.DoesNotExist,Order.DoesNotExist):
        return "held"

def reconcile_confirmed(domain_id):
    """Refresh expiry/status only from the same paid supplier resource."""
    try:
        domain=Domain.objects.get(pk=domain_id,registrar="cloudflare-registrar-live",management_kind="registrar")
        entry=domain.metadata[KEY]
        grant=signing.loads(entry["grant"],salt=SALT)
        if (entry.get("state")!="confirmed" or domain.provider_domain_id!=domain.domain_name
            or grant["domain"]!=domain.domain_name or grant["owner"]!=domain.client_id
            or not domain.order_item_id or grant["item"]!=domain.order_item_id
            or grant["order"]!=domain.order_item.order_id):
            return "held"
        row,secret,adapter=connector(grant["route"])
        if row.public_settings["account_id"]!=grant.get("account_id"):
            return "held"
        proof=adapter.live_registration_readback(domain.domain_name)
        created=parse_datetime(proof.get("registered_at") or "")
        expires=parse_datetime(proof.get("expires_at") or "")
        if (proof.get("domain_name")!=domain.domain_name or not created or not expires
            or created.utcoffset() is None or expires.utcoffset() is None
            or created!=domain.registration_date or expires<=created):
            return "held"
        state=proof.get("status")
        if state not in ("active","expired","suspended","redemption_period","pending_delete"):
            return "held"
        local="active" if state=="active" and expires>timezone.now() else ("suspended" if state=="suspended" else "expired")
        with transaction.atomic():
            locked=Domain.objects.select_for_update().get(pk=domain.pk)
            IntegrationConnection.objects.select_for_update().get(pk=row.pk)
            if (locked.metadata.get(KEY)!=entry or locked.client_id!=domain.client_id
                or locked.provider_domain_id!=domain.provider_domain_id or locked.registration_date!=created
                or load(grant["route"])[1]!=secret):
                return "held"
            changed=locked.expiry_date!=expires or locked.status!=local or locked.is_active!=(local=="active")
            locked.expiry_date=expires
            locked.next_due_date=expires
            locked.status=local
            locked.is_active=local=="active"
            locked.metadata={**locked.metadata,KEY:{**entry,"supplier_status":state,
                "last_reconciled_at":timezone.now().isoformat(),"reconcile_after":(timezone.now()+timedelta(hours=12)).isoformat()}}
            locked.save(update_fields=["expiry_date","next_due_date","status","is_active","metadata","updated_at"])
            if changed:
                AuditLog.objects.create(actor=None,action="live_domain_registration_reconciled",entity_type="Domain",
                    entity_id=str(locked.pk),entity_name=locked.domain_name,details={"supplier_status":state,"expires_at":expires.isoformat()})
        return "processed"
    except (RegistrationRefused,CloudflareINT01Denied,VaultUnavailable,DatabaseError,KeyError,TypeError,ValueError,
            signing.BadSignature,Domain.DoesNotExist,IntegrationConnection.DoesNotExist,IntegrationCredentialVersion.DoesNotExist):
        return "held"

def run_due():
    if not enabled():
        return None
    row=Domain.objects.filter(status="pending",registrar="cloudflare-registrar-live",order_item__order__status="paid",
        metadata__live_domain_registration_v1__state__in=("queued","uncertain")).order_by("updated_at","pk").first()
    if not row:
        confirmed=Domain.objects.filter(registrar="cloudflare-registrar-live",management_kind="registrar",
            metadata__live_domain_registration_v1__state="confirmed").filter(
                Q(metadata__live_domain_registration_v1__reconcile_after__isnull=True)|
                Q(metadata__live_domain_registration_v1__reconcile_after__lte=timezone.now().isoformat())
            ).order_by("updated_at","pk").first()
        if not confirmed:
            return None
        result=reconcile_confirmed(confirmed.pk)
        if result=="held":
            with transaction.atomic():
                locked=Domain.objects.select_for_update().get(pk=confirmed.pk)
                if locked.metadata.get(KEY)==confirmed.metadata.get(KEY):
                    locked.metadata={**locked.metadata,KEY:{**locked.metadata[KEY],
                        "reconcile_after":(timezone.now()+timedelta(hours=1)).isoformat()}}
                    locked.save(update_fields=["metadata","updated_at"])
        return result
    result=transition(row.pk)
    if result=="held":
        Domain.objects.filter(pk=row.pk,status="pending").update(updated_at=timezone.now())
    return result

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([DomainPurchaseThrottle])
def registration_checkout(request):
    data=request.data
    try:
        if isinstance(data,dict) and set(data)=={"domain"}:
            return Response(quote(request.user,data["domain"]),headers=HEADERS)
        if isinstance(data,dict) and set(data)=={"quote","contact","consent"} and data["consent"] is True:
            return Response(accept(request.user,data["quote"],data["contact"]),status=201,headers=HEADERS)
        raise RegistrationRefused("Review the registration terms and registrant contact.")
    except (RegistrationRefused,CloudflareINT01Denied,VaultUnavailable,DatabaseError,KeyError,TypeError,ValueError,InvalidOperation,DjangoValidationError,signing.BadSignature,
        TLDPricing.DoesNotExist,IntegrationConnection.DoesNotExist,IntegrationCredentialVersion.DoesNotExist):
        raise ValidationError("Live registration is unavailable or the quote needs renewal. No new charge was initiated.") from None
