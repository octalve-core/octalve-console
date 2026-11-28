"""Live mixed registrar/shared-hosting basket, one invoice and durable per-line claims."""
from decimal import Decimal
from uuid import UUID
from django.core import signing
from django.db import transaction,DatabaseError
from rest_framework.decorators import api_view,permission_classes,throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from billing.models import Invoice
from billing.contact import billing_contact_snapshot
from orders.models import Order,OrderItem
from orders.serializers import require_hosting_domains
from orders.shopping_cart import MAX_CHECKOUT_DOMAINS
from providers.registrar_live_policy import load
from providers.connection_vault import VaultUnavailable
from providers.connection_models import IntegrationConnection,IntegrationCredentialVersion
from providers.cloudflare_int01 import CloudflareINT01Denied,require_domain
from .models import Domain,TLDPricing
from .live_registration import KEY,SALT,HEADERS,quote,validate_contact,account_id,digest,enabled,RegistrationRefused
from .combined_cart import services_for
from .pilot import DomainPurchaseThrottle

CART="live_domain_cart_v1"
CART_SALT="octalve.live-domain-cart.v1"

def service_snapshot(items):
    result=[]
    for item in items:
        p=item["plan"];cycle=item["billing_cycle"];offer=item.get("published_catalog_offer")
        if item["item_type"]!="hosting" or item["quantity"]!=1 or not offer:
            raise RegistrationRefused("Only published shared/WordPress hosting is supported with live domains.")
        snap={"revision":offer.revision,"plan_id":p.pk,"currency":p.currency,
            "supplier_provider_id":offer.snapshot["supplier_provider_id"],"technical_package_id":offer.snapshot["technical_package_id"],
            "price":str(cycle.price),"setup_fee":str(cycle.setup_fee),"billing_period":cycle.cycle_key}
        result.append({"product_id":p.product_id,"plan_id":p.pk,"billing_cycle_id":cycle.pk,"item_type":"hosting",
            "description":item["description"],"domain_name":item["domain_name"],"quantity":1,
            "unit_price":str(item["unit_price"]),"cycle_key":cycle.cycle_key,"months":cycle.months,"config":{"catalog_offer_snapshot":snap}})
    return result

def validate_selection(names,services):
    if (not isinstance(names,list) or not 1<=len(names)<=MAX_CHECKOUT_DOMAINS
        or any(not isinstance(n,str) for n in names) or len(set(names))!=len(names)
        or not isinstance(services,list) or len(names)+len(services)>20):
        raise RegistrationRefused()
    names=sorted(require_domain(n) for n in names)
    if any(not isinstance(i,dict) or set(i)!={"plan_id","offer_revision","cycle_key","domain_name","quantity"} for i in services):
        raise RegistrationRefused()
    return names

def quote_cart(user,names,services):
    names=validate_selection(names,services)
    grants=[signing.loads(quote(user,name)["quote"],salt=SALT) for name in names]
    with transaction.atomic():
        items=services_for(services);require_hosting_domains(items);snaps=service_snapshot(items)
    lines=[{"name":g["domain"],"amount":g["retail"],"kind":"domain","period":"1 year"} for g in grants]+[
        {"name":s["description"],"amount":s["unit_price"],"kind":"hosting","domain":s["domain_name"],"period":s["cycle_key"]} for s in snaps]
    total=sum(Decimal(x["amount"]) for x in lines)
    if total<=0 or total>Decimal("9999999999.99"):raise RegistrationRefused()
    return {"quote":signing.dumps({"owner":user.pk,"domains":grants,"services":services,"snapshots":snaps,"total":str(total)},salt=CART_SALT),
        "lines":lines,"total":str(total),"currency":"NGN"}

@transaction.atomic
def accept_cart(user,token,contact,checkout_id):
    if not enabled() or user.role!="client" or not user.is_active or not user.email_verified_at: raise RegistrationRefused()
    if not isinstance(token,str) or len(token)>65536: raise RegistrationRefused()
    basket=signing.loads(token,salt=CART_SALT,max_age=300)
    if basket["owner"]!=user.pk:raise RegistrationRefused()
    key=str(UUID(checkout_id))
    contact=validate_contact(user,contact)
    type(user).objects.select_for_update().get(pk=user.pk)
    prior=Order.objects.filter(client=user,metadata__live_domain_cart_v1__checkout_id=key).first()
    if prior:
        if prior.metadata[CART]["basket_digest"]!=digest(basket) or prior.metadata[CART]["contact_digest"]!=digest(contact):raise RegistrationRefused()
        inv=prior.invoices.get()
        return {"invoice_public_id":str(inv.public_id)}
    names=validate_selection([g["domain"] for g in basket["domains"]],basket["services"])
    rates={p.tld:p for p in TLDPricing.objects.select_for_update().filter(tld__in=sorted({'.'+n.rsplit('.',1)[1] for n in names}),status="active").order_by("tld")}
    rows=[]
    for g in basket["domains"]:
        p=rates["."+g["domain"].rsplit(".",1)[1]]
        if g["owner"]!=user.pk or g["operation"]!="register" or g["years"]!=1 or str(p.register_price)!=g["retail"] or p.metadata.get("published_registrar")!=g["route"] or p.metadata.get("published_registrar_cost_v1")!=g["cost"]:raise RegistrationRefused()
        row,_=load(g["route"]);rows.append((g,p,row))
    if Domain.objects.filter(domain_name__in=names).exists():raise RegistrationRefused("Resume the existing domain invoice.")
    items=services_for(basket["services"]);require_hosting_domains(items);snaps=service_snapshot(items)
    if snaps!=basket["snapshots"]:raise RegistrationRefused()
    order=Order.objects.create(client=user,status="pending_payment",currency="NGN",metadata={"billing_contact":billing_contact_snapshot(user)})
    claims=[]
    for g,p,row in rows:
        item=OrderItem.objects.create(order=order,item_type="domain",product_id=0,plan_id=0,billing_cycle_id=0,domain_name=g["domain"],description=g["domain"]+" registration (1 year)",unit_price=p.register_price,cycle_key="1yr",months=12)
        claim=Domain.objects.create(client=user,domain_name=g["domain"],tld=p.tld,order_item=item,registration_type="register",registrar=row.adapter_key,status="pending",is_active=False,registration_date=None,auto_renew=False,registrant_contact=contact,metadata={KEY:{"state":"queued","grant":signing.dumps({**g,"order":order.pk,"item":item.pk,"account_id":account_id(row),"contact_digest":digest(contact)},salt=SALT)}})
        claims.append({"domain_id":claim.pk,"item":item.pk})
    for s in snaps:
        OrderItem.objects.create(order=order,**{**s,"unit_price":Decimal(s["unit_price"])})
    order.refresh_from_db()
    if order.total!=Decimal(basket["total"]):raise RegistrationRefused()
    order.metadata={**order.metadata,KEY:{"claims":claims},CART:{"checkout_id":key,"basket_digest":digest(basket),"contact_digest":digest(contact),
        "contract":signing.dumps({"order":order.pk,"owner":user.pk,"claims":claims,"total":basket["total"],"items":item_snapshot(order)},salt=CART_SALT)}}
    order.save(update_fields=["metadata","updated_at"])
    invoice=Invoice.create_from_order(order)
    return {"invoice_public_id":str(invoice.public_id)}

def item_snapshot(order):
    return [{"id":i.pk,"kind":i.item_type,"domain":i.domain_name,"amount":str(i.subtotal),"plan":i.plan_id,
        "quantity":i.quantity,"months":i.months,"config":i.config} for i in order.items.order_by("pk")]

def claims_for(order):
    if CART not in order.metadata:
        if order.items.count()!=1:raise RegistrationRefused()
        return [order.metadata[KEY]]
    contract=signing.loads(order.metadata[CART]["contract"],salt=CART_SALT)
    claims=order.metadata[KEY]["claims"]
    if (contract["owner"]!=order.client_id or contract["order"]!=order.pk or contract["claims"]!=claims
        or Decimal(contract["total"])!=order.total or contract["items"]!=item_snapshot(order)
        or not 1<=len(claims)<=MAX_CHECKOUT_DOMAINS
        or {c["item"] for c in claims}!=set(order.items.filter(item_type="domain").values_list("pk",flat=True))):
        raise RegistrationRefused()
    return claims

def payment_ready(invoice):
    order=invoice.order
    for c in claims_for(order):
        d=Domain.objects.select_for_update().get(pk=c["domain_id"],client_id=invoice.client_id,order_item_id=c["item"],order_item__order_id=order.pk,status="pending")
        grant=signing.loads(d.metadata[KEY]["grant"],salt=SALT)
        if (d.metadata[KEY]["state"]!="queued" or grant["order"]!=order.pk or grant["owner"]!=invoice.client_id
            or grant["item"]!=d.order_item_id or grant["domain"]!=d.domain_name or digest(d.registrant_contact)!=grant["contact_digest"]
            or Decimal(grant["retail"])!=d.order_item.subtotal):
            raise RegistrationRefused()
        load(grant["route"])
    return True

def all_domains_confirmed(order):
    if KEY not in order.metadata: return True
    for c in claims_for(order):
        if not Domain.objects.filter(pk=c["domain_id"],order_item_id=c["item"],client_id=order.client_id,
            metadata__live_domain_registration_v1__state="confirmed",provider_domain_id__isnull=False).exists():
            return False
    return True

def finish_domain_order(order):
    if not all_domains_confirmed(order): return
    if not order.items.exclude(item_type="domain").exists():
        order.mark_provisioned()
    else:
        from services.commercial_scheduler import wake
        wake("staging")

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([DomainPurchaseThrottle])
def checkout(request):
    try:
        data=request.data
        if not isinstance(data,dict):raise RegistrationRefused()
        if set(data)=={"domains","services"}:
            return Response(quote_cart(request.user,data["domains"],data["services"]),headers=HEADERS)
        if set(data)=={"quote","contact","checkout_id","consent"} and data["consent"] is True:
            return Response(accept_cart(request.user,data["quote"],data["contact"],data["checkout_id"]),status=201,headers=HEADERS)
        raise RegistrationRefused()
    except (RegistrationRefused,CloudflareINT01Denied,VaultUnavailable,DatabaseError,KeyError,TypeError,ValueError,ArithmeticError,signing.BadSignature,IntegrationConnection.DoesNotExist,IntegrationCredentialVersion.DoesNotExist,TLDPricing.DoesNotExist):
        raise ValidationError("Live cart is unavailable or changed. No new payment was initiated.") from None
