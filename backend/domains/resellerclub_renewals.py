"""One invoice per supplier expiry; extend only on independent paid readback."""
from datetime import timedelta
from decimal import Decimal
from django.core import signing
from django.db import transaction,DatabaseError
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from dateutil.relativedelta import relativedelta
from audit.models import AuditLog
from billing.models import Invoice
from billing.contact import billing_contact_snapshot
from orders.models import Order,OrderItem
from payments.models import Transaction,PaymentGateway
from payments.live_binding import resolve_live_key
from provisioning.authority import require_verified_settlement,SettlementNotVerified
from providers.connection_models import IntegrationConnection,IntegrationCredentialVersion
from providers.connection_vault import VaultUnavailable
from providers.registrar_live_policy import load
from providers.resellerclub_live import ResellerClubUnavailable
from .models import Domain,TLDPricing
from .live_registration import KEY,RegistrationRefused,enabled
from .resellerclub_lifecycle import managed,read

RENEW="registrar_renewal_v1"
SALT="octalve.domain-renewal.v1"
ERRORS=(RegistrationRefused,ResellerClubUnavailable,VaultUnavailable,DatabaseError,KeyError,ValueError,TypeError,
    signing.BadSignature,Domain.DoesNotExist,Order.DoesNotExist,Invoice.DoesNotExist,TLDPricing.DoesNotExist,
    IntegrationConnection.DoesNotExist,IntegrationCredentialVersion.DoesNotExist,SettlementNotVerified,ArithmeticError)

def price_for(domain,grant,adapter):
    price=TLDPricing.objects.get(tld=domain.tld,status="active")
    route=price.metadata.get("published_registrar",{})
    cost=price.metadata.get("published_registrar_cost_v1",{})
    if (route.get("connection_id")!=grant["route"]["connection_id"]
        or route.get("credential_version")!=grant["route"]["credential_version"]
        or route.get("revision")!=cost.get("revision") or price.renewal_price<=0):
        raise RegistrationRefused()
    # Standard non-premium renewal cost comes from a fresh standard TLD quote.
    # No quote, no invoice, no supplier spend.
    import secrets
    sample="oc-renew-"+secrets.token_hex(10)+domain.tld
    proof=adapter.live_domain_check(sample)
    if proof.get("name")!=sample or proof.get("registrable") is not True or proof.get("currency")!=cost["currency"]:
        raise RegistrationRefused()
    amount=Decimal(proof["renewal_cost"])
    if amount<=0 or amount>Decimal(cost["renewal_cost"]) or amount*Decimal(cost["ngn_per_unit"])>price.renewal_price:
        raise RegistrationRefused()
    return price,cost,str(amount)

def create_invoice(domain,*,automatic=False):
    entry,grant,row,secret,adapter=managed(domain)
    if domain.status!="active" or not domain.expiry_date or domain.expiry_date<=timezone.now():
        raise RegistrationRefused()
    existing=domain.metadata.get(RENEW,{})
    if existing.get("state") in ("queued","uncertain"):
        invoice=Invoice.objects.get(pk=existing["invoice"],client_id=domain.client_id)
        return {"invoice_public_id":str(invoice.public_id),"state":existing["state"]}
    if automatic and (not domain.auto_renew or domain.expiry_date>timezone.now()+timedelta(days=30)):
        raise RegistrationRefused()
    gateway=PaymentGateway.objects.filter(code="paystack",status="active",test_mode=False).first()
    if not gateway or not resolve_live_key(gateway): raise RegistrationRefused()
    proof=read(domain,entry,adapter)
    if proof["status"]!="Active" or parse_datetime(proof["expires_at"])!=domain.expiry_date:
        raise RegistrationRefused()
    price,cost,supplier=price_for(domain,grant,adapter)
    with transaction.atomic():
        locked=Domain.objects.select_for_update().get(pk=domain.pk)
        if locked.metadata!=domain.metadata or locked.expiry_date!=domain.expiry_date or (automatic and not locked.auto_renew):
            raise RegistrationRefused()
        current=TLDPricing.objects.select_for_update().get(pk=price.pk)
        if current.metadata!=price.metadata or current.renewal_price!=price.renewal_price or current.status!="active":
            raise RegistrationRefused()
        if load(grant["route"])[1]!=secret: raise RegistrationRefused()
        order=Order.objects.create(client_id=domain.client_id,status="pending_payment",source="renewal",currency="NGN",
            metadata={"billing_contact":billing_contact_snapshot(domain.client)})
        item=OrderItem.objects.create(order=order,item_type="domain",product_id=0,plan_id=0,billing_cycle_id=0,
            domain_name=domain.domain_name,description=domain.domain_name+" renewal (1 year)",unit_price=price.renewal_price,cycle_key="1yr",months=12)
        order.refresh_from_db()
        contract={"domain":domain.pk,"owner":domain.client_id,"order":order.pk,"item":item.pk,"name":domain.domain_name,
            "old_expiry":domain.expiry_date.isoformat(),"provider_order":domain.provider_domain_id,"route":grant["route"],
            "amount":str(price.renewal_price),"supplier_amount":supplier,"cost":cost}
        token=signing.dumps(contract,salt=SALT)
        order.metadata={**order.metadata,RENEW:token};order.save(update_fields=["metadata","updated_at"])
        invoice=Invoice.create_from_order(order)
        invoice.metadata={**invoice.metadata,"type":"domain_renewal","domain_id":domain.pk}
        invoice.save(update_fields=["metadata","updated_at"])
        locked.metadata={**locked.metadata,RENEW:{"state":"queued","invoice":invoice.pk,"grant":token}}
        locked.save(update_fields=["metadata","updated_at"])
        AuditLog.objects.create(actor=None,action="domain_renewal_invoice_issued",entity_type="Domain",entity_id=str(domain.pk),entity_name=domain.domain_name,details={"invoice":invoice.pk,"automatic":automatic})
    return {"invoice_public_id":str(invoice.public_id),"state":"queued"}

def contract(invoice,*,lock=False):
    token=invoice.order.metadata[RENEW]
    grant=signing.loads(token,salt=SALT)
    qs=Domain.objects
    if lock: qs=qs.select_for_update()
    domain=qs.get(pk=grant["domain"])
    entry=domain.metadata[RENEW]
    registration,original,row,secret,adapter=managed(domain)
    items=list(invoice.order.items.all()[:2])
    if (entry["grant"]!=token or entry["invoice"]!=invoice.pk or domain.client_id!=invoice.client_id
        or grant["owner"]!=invoice.client_id or grant["order"]!=invoice.order_id or grant["name"]!=domain.domain_name
        or grant["provider_order"]!=domain.provider_domain_id or grant["route"]!=original["route"]
        or domain.expiry_date!=parse_datetime(grant["old_expiry"]) or invoice.currency!="NGN"
        or invoice.total!=Decimal(grant["amount"]) or invoice.order.total!=invoice.total
        or len(items)!=1 or items[0].pk!=grant["item"] or items[0].domain_name!=domain.domain_name
        or items[0].item_type!="domain" or items[0].subtotal!=invoice.total or items[0].months!=12 or items[0].quantity!=1):
        raise RegistrationRefused()
    return domain,entry,grant,registration,row,secret,adapter

def payment_ready(invoice):
    domain,entry,grant,*_=contract(invoice,lock=True)
    return entry["state"]=="queued" and domain.status=="active" and domain.expiry_date>timezone.now()

def paid(invoice,*,lock=False):
    rows=Transaction.objects.filter(invoice=invoice,status="successful",transaction_type="payment")
    if lock: rows=rows.select_for_update()
    rows=list(rows[:2])
    if len(rows)!=1 or rows[0].gateway.code!="paystack" or not rows[0].webhook_verified or rows[0].metadata.get("payment_mode")!="live":
        raise RegistrationRefused()
    require_verified_settlement(invoice,rows[0])

def advance(invoice_id):
    try:
        invoice=Invoice.objects.get(pk=invoice_id)
        domain,entry,grant,reg,row,secret,adapter=contract(invoice)
        paid(invoice)
        proof=read(domain,reg,adapter)
        expiry=parse_datetime(proof["expires_at"])
        if entry["state"]=="queued":
            if expiry!=domain.expiry_date or proof["status"]!="Active" or expiry<=timezone.now(): return "held"
            price,cost,supplier=price_for(domain,{"route":grant["route"]},adapter)
            if cost!=grant["cost"] or Decimal(supplier)>Decimal(grant["supplier_amount"]): return "held"
            with transaction.atomic():
                inv=Invoice.objects.select_for_update().get(pk=invoice_id)
                locked,current,g,_,_,s,_=contract(inv,lock=True);paid(inv,lock=True)
                if current!=entry or g!=grant or s!=secret: raise RegistrationRefused()
                locked.metadata={**locked.metadata,RENEW:{**entry,"state":"uncertain","reserved_at":timezone.now().isoformat()}}
                locked.save(update_fields=["metadata","updated_at"])
                AuditLog.objects.create(actor=None,action="domain_renewal_reserved",entity_type="Domain",entity_id=str(domain.pk),entity_name=domain.domain_name,details={"invoice":invoice_id})
            if load(grant["route"])[1]==secret:
                adapter.renew(domain.provider_domain_id,int(expiry.timestamp()))
            return "processed"
        if entry["state"]!="uncertain" or proof["status"]!="Active" or not domain.expiry_date+relativedelta(years=1)-timedelta(days=1)<=expiry<=domain.expiry_date+relativedelta(years=1)+timedelta(days=1):
            return "held"
        with transaction.atomic():
            inv=Invoice.objects.select_for_update().get(pk=invoice_id)
            locked,current,g,_,_,s,_=contract(inv,lock=True);paid(inv,lock=True)
            if current!=entry or g!=grant or s!=secret: raise RegistrationRefused()
            locked.expiry_date=expiry;locked.next_due_date=expiry
            locked.metadata={**locked.metadata,RENEW:{**entry,"state":"confirmed","expires_at":expiry.isoformat()}}
            locked.save(update_fields=["expiry_date","next_due_date","metadata","updated_at"])
            order=Order.objects.select_for_update().get(pk=invoice.order_id);order.mark_provisioned()
            AuditLog.objects.create(actor=None,action="domain_renewal_confirmed",entity_type="Domain",entity_id=str(domain.pk),entity_name=domain.domain_name,details={"invoice":invoice_id,"expiry":expiry.isoformat()})
        return "processed"
    except ERRORS:
        return "held"

def run_due():
    if not enabled(): return None
    due=Invoice.objects.filter(status="paid",order__status="paid",order__metadata__has_key=RENEW).order_by("updated_at","pk").first()
    if due:
        outcome=advance(due.pk)
        if outcome=="held": Invoice.objects.filter(pk=due.pk).update(updated_at=timezone.now())
        return outcome
    domain=Domain.objects.filter(registrar="resellerclub",status="active",auto_renew=True,expiry_date__gt=timezone.now(),
        expiry_date__lte=timezone.now()+timedelta(days=30),metadata__live_domain_registration_v1__state="confirmed").exclude(
            metadata__registrar_renewal_v1__state__in=("queued","uncertain")).filter(
            Q(metadata__renewal_retry_after__isnull=True)|Q(metadata__renewal_retry_after__lte=timezone.now().isoformat())).order_by("expiry_date","pk").first()
    if not domain:return None
    try:
        create_invoice(domain,automatic=True)
        return "processed"
    except ERRORS:
        with transaction.atomic():
            locked=Domain.objects.select_for_update().get(pk=domain.pk)
            if locked.metadata==domain.metadata:
                locked.metadata={**locked.metadata,"renewal_retry_after":(timezone.now()+timedelta(hours=12)).isoformat()}
                locked.save(update_fields=["metadata","updated_at"])
        return "held"
