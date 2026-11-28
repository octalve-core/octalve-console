"""One calendar renewal order per existing hosting service and exact term.

The current published offer and expressly approved tax/timing policy are frozen.
Renewal is never a provisioning task or a recurring-card charge. Paid invoices
are reconciled separately so a supplier or entitlement failure cannot roll back
a verified financial settlement.
"""
import calendar
import hashlib
import hmac
import json
from datetime import timedelta
from decimal import Decimal,InvalidOperation,ROUND_HALF_UP
from django.conf import settings
from django.db import transaction,DatabaseError
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from dateutil.relativedelta import relativedelta
from audit.models import AuditLog
from billing.models import Invoice,InvoiceItem
from catalog.models import Plan,PlanBillingCycle,PublishedCatalogOffer
from orders.models import Order,OrderItem
from payments.models import Transaction
from providers.connection_audit import audit_keyring
from providers.connection_vault import VaultUnavailable
from providers.hosting_runtime import qualified_vault
from opanel_bridge.models import VerifiedHostingBinding
from opanel_bridge.policy import account_digest
from provisioning.authority import require_verified_settlement,SettlementNotVerified
from settings_registry.console_policy import invoice_issuance_policy
from settings_registry.mail_authority import queue_invoice_issued
from .models import Service,ServiceActionLog

KEY="hosting_renewal_v1"
POLICY="hosting_renewal_policy_v1"
MONTHS={"1mo":1,"3mo":3,"6mo":6,"12mo":12,"24mo":24,"36mo":36}
CENT=Decimal("0.01")

class RenewalRefused(ValueError):
    pass

def enabled():
    return bool(getattr(settings,"CLOUD_HOSTING_RENEWALS_ENABLED",False) and qualified_vault())

def _mac(payload,key,context):
    return hmac.new(key,context.encode()+b"\0"+json.dumps(payload,sort_keys=True,separators=(",",":")).encode(),hashlib.sha256).hexdigest()

def seal(payload,context):
    active,keys=audit_keyring()
    return {"payload":payload,"key_id":active,"mac":_mac(payload,keys[active],context)}

def unseal(value,context):
    try:
        _,keys=audit_keyring()
        p=value["payload"]
        if not isinstance(p,dict) or not hmac.compare_digest(value["mac"],_mac(p,keys[value["key_id"]],context)):
            raise RenewalRefused("Invalid renewal authority.")
        return p
    except (KeyError,TypeError,ValueError,VaultUnavailable):
        raise RenewalRefused("Invalid renewal authority.") from None

def validate_policy(data):
    if not isinstance(data,dict) or set(data)!={"enabled","invoice_lead_days","reminder_days","tax_mode","tax_rate"}:
        raise RenewalRefused("Invalid renewal policy.")
    if (type(data["enabled"]) is not bool or type(data["invoice_lead_days"]) is not int
            or not 1<=data["invoice_lead_days"]<=30 or type(data["reminder_days"]) is not int
            or not 0<=data["reminder_days"]<data["invoice_lead_days"]
            or data["tax_mode"] not in ("exclusive","inclusive")):
        raise RenewalRefused("Invalid renewal timing or tax policy.")
    try:
        rate=Decimal(str(data["tax_rate"]))
        if not rate.is_finite() or not 0<=rate<=30 or rate.as_tuple().exponent < -2:
            raise ValueError()
    except (InvalidOperation,ValueError,TypeError):
        raise RenewalRefused("Invalid renewal tax rate.") from None
    return {**data,"tax_rate":format(rate.quantize(CENT),"f")}

def policy():
    row=AuditLog.objects.filter(action=POLICY,entity_type="HostingRenewalPolicy",entity_id="global").order_by("-pk").first()
    if not row:
        return None
    p=unseal(row.details,POLICY)
    return {"revision":row.pk,**validate_policy(p)}

def save_policy(data,actor):
    value=validate_policy(data)
    row=AuditLog.objects.create(actor=actor,action=POLICY,entity_type="HostingRenewalPolicy",entity_id="global",
        entity_name="Hosting renewal policy",details=seal(value,POLICY))
    return {"revision":row.pk,**value}

def end_of_term(start,months,anchor):
    if timezone.is_naive(start) or type(months) is not int or months not in MONTHS.values() or type(anchor) is not int or not 1<=anchor<=31:
        raise RenewalRefused("Invalid calendar period.")
    result=start+relativedelta(months=months)
    return result.replace(day=min(anchor,calendar.monthrange(result.year,result.month)[1]))

def _original(service, *, allow_suspended=False):
    if (service.service_type!="hosting" or (service.status!="active" and not (allow_suspended and service.status=="suspended" and service.suspension_reason=="Octalve verified nonpayment")) or not service.auto_renew
            or not service.client.is_active or not service.activated_at or not service.provider_identifier
            or not service.order_id or not service.invoice_id or not service.order_item_id
            or not service.provider_id or not service.provider_package_id or service.billing_cycle not in MONTHS):
        raise RenewalRefused("Service is not eligible for automatic renewal.")
    original=Invoice.objects.select_related("order").filter(pk=service.invoice_id,client_id=service.client_id,
        order_id=service.order_id,status="paid",amount_due=0).first()
    if (not original or original.amount_paid!=original.total or original.order.status!="provisioned"
            or original.order.client_id!=service.client_id or service.order_item.order_id!=service.order_id
            or not Transaction.objects.filter(invoice=original,client_id=service.client_id,status="successful",
                    transaction_type="payment",gateway__test_mode=False,metadata__provider_api_verified=True,
                    amount=original.total,currency=original.currency).exists()):
        raise RenewalRefused("Original paid hosting authority is unavailable.")
    proof=VerifiedHostingBinding.objects.filter(service=service,revoked_at__isnull=True,
        confirmation_source="provider_api_readback",provider_id_snapshot=service.provider_id).first()
    digest=account_digest(service)
    if not proof or not digest or proof.account_digest!=digest or proof.confirmed_at<service.activated_at:
        raise RenewalRefused("Original supplier account proof is unavailable.")
    if Service.objects.filter(provider_id=service.provider_id,provider_identifier__iexact=service.provider_identifier).exclude(pk=service.pk).exists():
        raise RenewalRefused("Ambiguous hosting account.")
    if service.metadata.get("hosting_cancellation_v1") or ServiceActionLog.objects.filter(service=service,action="cancel",details__state="pending_review").exists():
        raise RenewalRefused("Cancellation is awaiting review.")
    return proof

def _price(service,p):
    plan=Plan.objects.select_for_update().filter(pk=service.plan_id,product_id=service.product_id,status="active",is_public=True,
        product__status="active",product__is_public=True,product__category__is_active=True,currency=service.currency).first()
    if not plan:
        raise RenewalRefused("Current published plan unavailable.")
    revision=PublishedCatalogOffer.objects.filter(plan=plan).order_by("-revision").first()
    cycle=PlanBillingCycle.objects.filter(plan=plan,cycle_key=service.billing_cycle,is_active=True,months=MONTHS[service.billing_cycle]).first()
    if not revision or not cycle:
        raise RenewalRefused("Published renewal period unavailable.")
    snap=revision.snapshot
    if snap.get("supplier_provider_id")!=service.provider_id or snap.get("technical_package_id")!=service.provider_package_id or snap.get("currency")!=service.currency:
        raise RenewalRefused("Published package differs from existing service.")
    rows=[row for row in snap.get("billing_cycles",[]) if row.get("cycle_key")==cycle.cycle_key]
    if len(rows)!=1 or Decimal(rows[0]["price"])!=cycle.price or not 0<cycle.price<=Decimal("9999999999.99"):
        raise RenewalRefused("Published price changed.")
    rate=Decimal(p["tax_rate"])/100
    if p["tax_mode"]=="inclusive":
        subtotal=(cycle.price/(1+rate)).quantize(CENT,rounding=ROUND_HALF_UP)
        tax=cycle.price-subtotal
    else:
        subtotal=cycle.price
        tax=(subtotal*rate).quantize(CENT,rounding=ROUND_HALF_UP)
    total=subtotal+tax
    if total>Decimal("9999999999.99"):
        raise RenewalRefused("Renewal price exceeds supported bounds.")
    return cycle,revision,subtotal,tax,total

@transaction.atomic
def issue(service_id,*,now=None):
    if not enabled():
        raise RenewalRefused("Renewal worker is disabled.")
    p=policy()
    if not p or not p["enabled"]:
        raise RenewalRefused("Renewal policy has not been approved.")
    now=now or timezone.now()
    service=Service.objects.select_for_update().get(pk=service_id)
    proof=_original(service)
    start=service.next_due_date
    if start>now+timedelta(days=p["invoice_lead_days"]):
        raise RenewalRefused("Renewal is not due for invoicing.")
    anchor=service.metadata.get("renewal_calendar_anchor",start.day)
    end=end_of_term(start,MONTHS[service.billing_cycle],anchor)
    if end<=now:
        raise RenewalRefused("Historical unpaid period requires review.")
    candidates=list(Invoice.objects.filter(client_id=service.client_id,metadata__type="renewal",metadata__service_id=service.pk)
        .filter(items__period_start=start).distinct()[:2])
    if candidates:
        if len(candidates)!=1 or KEY not in candidates[0].metadata:
            raise RenewalRefused("Conflicting legacy renewal invoice.")
        prior=candidates[0]
        if prior.status not in ("unpaid","paid") or unseal(prior.metadata[KEY],KEY).get("start")!=start.isoformat():
            raise RenewalRefused("Renewal invoice requires review.")
        return prior,False
    if Invoice.objects.filter(client_id=service.client_id,metadata__type="renewal",metadata__service_id=service.pk,
                              status__in=("unpaid","overdue","partially_paid")).exists():
        raise RenewalRefused("Another renewal invoice remains unresolved.")
    cycle,revision,subtotal,tax,total=_price(service,p)
    if policy()!=p:
        raise RenewalRefused("Renewal policy changed.")
    payload={"service":service.pk,"owner":service.client_id,"provider":service.provider_id,
        "account_digest":proof.account_digest,"binding":str(proof.binding_ref),"plan":service.plan_id,
        "product":service.product_id,"cycle":service.billing_cycle,"months":cycle.months,
        "currency":service.currency,"start":start.isoformat(),"end":end.isoformat(),"anchor":anchor,
        "offer_revision":revision.revision,"policy_revision":p["revision"],"tax_rate":p["tax_rate"],"tax_mode":p["tax_mode"],
        "subtotal":str(subtotal),"tax":str(tax),"total":str(total)}
    order=Order.objects.create(client_id=service.client_id,status="pending_payment",source="renewal",
        currency=service.currency,subtotal=subtotal,tax_total=tax,total=total)
    item=OrderItem.objects.create(order=order,product_id=service.product_id,plan_id=service.plan_id,billing_cycle_id=cycle.pk,
        item_type="hosting",description=f"Renewal of {service.label} ({service.billing_cycle})",domain_name=service.domain_name,
        quantity=1,unit_price=subtotal,subtotal=subtotal,cycle_key=service.billing_cycle,months=cycle.months,
        metadata={"renewal_only":True})
    invoice_policy=invoice_issuance_policy()
    invoice=Invoice.objects.create(order=order,client_id=service.client_id,currency=service.currency,status="unpaid",
        subtotal=subtotal,tax_total=tax,total=total,due_date=start,metadata={"type":"renewal","service_id":service.pk,
        "invoice_policy":invoice_policy,"invoice_template_id":invoice_policy["template_id"]})
    row=InvoiceItem.objects.create(invoice=invoice,description=item.description,product_id=service.product_id,plan_id=service.plan_id,
        service_id=service.pk,domain_name=service.domain_name,quantity=1,unit_price=subtotal,subtotal=subtotal,
        period_start=start,period_end=end,metadata={"order_item_id":item.pk})
    grant=seal({**payload,"order":order.pk,"invoice":invoice.pk,"item":item.pk,"invoice_item":row.pk},KEY)
    order.metadata={KEY:grant}
    order.save(update_fields=["metadata","updated_at"])
    invoice.metadata={**invoice.metadata,KEY:grant}
    invoice.save(update_fields=["metadata","updated_at"])
    queue_invoice_issued(invoice)
    return invoice,True

@transaction.atomic
def apply(invoice_id):
    if not enabled():
        raise RenewalRefused("Renewal worker is disabled.")
    invoice=Invoice.objects.select_for_update().get(pk=invoice_id)
    grant=invoice.metadata.get(KEY)
    p=unseal(grant,KEY)
    order=Order.objects.select_for_update().get(pk=invoice.order_id)
    if order.source!="renewal" or order.metadata.get(KEY)!=grant or p["invoice"]!=invoice.pk or p["order"]!=order.pk:
        raise RenewalRefused("Renewal order authority changed.")
    service=Service.objects.select_for_update().get(pk=p["service"])
    if (p["owner"]!=service.client_id or invoice.client_id!=service.client_id or order.client_id!=service.client_id
            or p["provider"]!=service.provider_id or p["plan"]!=service.plan_id or p["product"]!=service.product_id
            or p["cycle"]!=service.billing_cycle or p["currency"]!=service.currency):
        raise RenewalRefused("Renewal service authority changed.")
    if order.status=="provisioned" and invoice.metadata.get("renewal_applied") is True:
        return False
    if service.metadata.get("hosting_lifecycle_v1",{}).get("state")=="dispatched_uncertain":
        raise RenewalRefused("Lifecycle outcome requires readback before renewal extension.")
    proof=_original(service,allow_suspended=True)
    if proof.account_digest!=p["account_digest"] or str(proof.binding_ref)!=p["binding"]:
        raise RenewalRefused("Supplier binding changed.")
    start,end=parse_datetime(p["start"]),parse_datetime(p["end"])
    if not start or not end or service.next_due_date!=start or end!=end_of_term(start,p["months"],p["anchor"]):
        raise RenewalRefused("Renewal term changed.")
    rows=list(invoice.items.all()[:2])
    items=list(order.items.all()[:2])
    if (len(rows)!=1 or len(items)!=1 or rows[0].pk!=p["invoice_item"] or items[0].pk!=p["item"]
            or rows[0].service_id!=service.pk or rows[0].period_start!=start or rows[0].period_end!=end
            or rows[0].subtotal!=Decimal(p["subtotal"]) or items[0].subtotal!=Decimal(p["subtotal"])
            or invoice.subtotal!=Decimal(p["subtotal"]) or invoice.tax_total!=Decimal(p["tax"])
            or invoice.total!=Decimal(p["total"]) or order.total!=invoice.total or order.tax_total!=invoice.tax_total):
        raise RenewalRefused("Renewal financial snapshot changed.")
    payments=list(Transaction.objects.select_related("gateway").filter(invoice=invoice,status="successful")[:2])
    if len(payments)!=1:
        raise RenewalRefused("Exactly one verified renewal payment is required.")
    try:
        require_verified_settlement(invoice,payments[0])
    except SettlementNotVerified:
        raise RenewalRefused("Renewal payment not verified.") from None
    service.next_due_date=end
    service.amount=invoice.total
    service.metadata={**service.metadata,"renewal_calendar_anchor":p["anchor"]}
    service.save(update_fields=["next_due_date","amount","metadata","updated_at"])
    invoice.metadata={**invoice.metadata,"renewal_applied":True}
    invoice.save(update_fields=["metadata","updated_at"])
    order.status="provisioned"
    order.provisioned_at=timezone.now()
    order.save(update_fields=["status","provisioned_at","updated_at"])
    AuditLog.objects.create(actor=None,action="hosting_renewal_applied",entity_type="Service",entity_id=str(service.pk),
        entity_name="Verified hosting renewal",details={"invoice_id":invoice.pk,"end":p["end"]})
    return True

def reminder_context(invoice, *, now=None, issuance=False):
    """Only current signed unpaid renewal terms within the approved window."""
    now=now or timezone.now()
    p=policy()
    if not enabled() or not p or not p["enabled"]:
        return None
    try:
        grant=invoice.metadata[KEY]
        term=unseal(grant,KEY)
        service=Service.objects.select_related("client").get(pk=term["service"])
        if (invoice.status!="unpaid" or invoice.amount_paid!=0 or invoice.amount_due!=invoice.total
                or invoice.total<=0 or invoice.client_id!=service.client_id
                or invoice.order_id!=term["order"] or invoice.pk!=term["invoice"]
                or invoice.order.source!="renewal" or invoice.order.status!="pending_payment"
                or invoice.order.metadata.get(KEY)!=grant or invoice.order.client_id!=service.client_id
                or service.status!="active" or not service.auto_renew or not service.client.is_active
                or term["owner"]!=service.client_id or term["start"]!=service.next_due_date.isoformat()
                or invoice.due_date!=service.next_due_date or invoice.currency!=term["currency"]
                or invoice.total!=Decimal(term["total"])
                or not now<=invoice.due_date<=now+timedelta(days=p["invoice_lead_days"] if issuance else p["reminder_days"])):
            return None
        _original(service)
        return {"invoice.number":str(invoice.invoice_number),
                "invoice.due_date":timezone.localtime(invoice.due_date).strftime("%d %b %Y"),
                "service.label":service.label,"service.renewal_date":timezone.localtime(service.next_due_date).strftime("%d %b %Y"),
                "order.number":str(invoice.order.order_number)}
    except (RenewalRefused,Service.DoesNotExist,KeyError,ValueError,TypeError,InvalidOperation):
        return None

def queue_due_reminders(limit=10):
    from settings_registry.mail_authority import _transactional_event
    from settings_registry.models import ConsoleMailOutbox
    from django.db.models import Exists,OuterRef,CharField,Value
    from django.db.models.functions import Concat,Cast
    p=policy()
    if not enabled() or not p or not p["enabled"]:
        return 0
    now=timezone.now()
    existing=ConsoleMailOutbox.objects.filter(idempotency_key=Concat(Value("invoice:"),Cast(OuterRef("pk"),CharField()),Value(":renewal_reminder")))
    ids=list(Invoice.objects.filter(status="unpaid",order__source="renewal",metadata__has_key=KEY,
        due_date__gte=now,due_date__lte=now+timedelta(days=p["reminder_days"]))
        .annotate(notified=Exists(existing)).filter(notified=False).order_by("due_date","pk").values_list("pk",flat=True)[:min(max(int(limit),1),20)])
    count=0
    for pk in ids:
        with transaction.atomic():
            invoice=Invoice.objects.select_for_update().get(pk=pk)
            context=reminder_context(invoice,now=now)
            if context:
                count+=int(_transactional_event(f"invoice:{pk}:renewal_reminder","invoice_due",invoice.client,context))
    return count

def run_due(limit=10):
    out={"enabled":enabled(),"issued":0,"applied":0,"held":0,"reminders":0}
    if not out["enabled"]:
        return out
    limit=min(max(int(limit),1),20)
    for pk in Invoice.objects.filter(status="paid",order__source="renewal",order__status="paid",metadata__has_key=KEY).order_by("pk").values_list("pk",flat=True)[:limit]:
        try:
            out["applied"]+=int(apply(pk))
        except (RenewalRefused,DatabaseError,ValueError,KeyError,TypeError,InvalidOperation):
            out["held"]+=1
    p=policy()
    if not p or not p["enabled"]:
        return out
    # Scan only terms without a current invoice; the service lock is the actual fence.
    from django.db.models import Exists,OuterRef
    current=InvoiceItem.objects.filter(service_id=OuterRef("pk"),period_start=OuterRef("next_due_date"),invoice__metadata__type="renewal")
    ids=Service.objects.filter(service_type="hosting",status="active",auto_renew=True,next_due_date__lte=timezone.now()+timedelta(days=p["invoice_lead_days"])).annotate(already=Exists(current)).filter(already=False).order_by("next_due_date","pk").values_list("pk",flat=True)[:limit]
    for pk in ids:
        try:
            _,created=issue(pk)
            out["issued"]+=int(created)
        except (RenewalRefused,DatabaseError,ValueError,KeyError,TypeError,InvalidOperation):
            out["held"]+=1
    out["reminders"]=queue_due_reminders(limit)
    return out
