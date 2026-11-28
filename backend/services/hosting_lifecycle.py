"""Verified nonpayment suspension/restoration, with a durable readback-only fence.

No supplier operation is selected by a customer. Never restore third-party
security/abuse holds. Permanent removal is a separate retention workflow.
"""
import uuid
from datetime import timedelta
from django.conf import settings
from django.db import transaction,DatabaseError
from django.utils import timezone
from billing.models import Invoice
from payments.models import PaymentIntent,Transaction,WebhookEvent
from providers.models import Provider
from providers.connection_models import IntegrationConnection
from providers.connection_vault import VaultUnavailable
from providers.hosting_runtime import load_hosting_connection,qualified_vault
from providers.pinned_egress import SupplierEgressDenied
from provisioning.models import ProvisioningTask
from provisioning.account_creation_plan import AccountCreationPlan
from provisioning.hosting_vendor_protocol import PinnedHostingProtocol,VendorProtocolRefused
from provisioning.authority import evaluate_payment_to_provisioning
from opanel_bridge.models import VerifiedHostingBinding,OPanelLaunchGrant
from opanel_bridge.policy import account_digest
from audit.models import AuditLog
from .models import Service,ServiceSuspension,ServiceActionLog
from .renewals import seal,unseal,KEY as RENEWAL_KEY,RenewalRefused

FENCE="hosting_lifecycle_v1"
POLICY="hosting_lifecycle_policy_v1"

def enabled():
    return bool(getattr(settings,"CLOUD_HOSTING_LIFECYCLE_ENABLED",False) and qualified_vault())

def validate_policy(value):
    if (not isinstance(value,dict) or set(value)!={"enabled","grace_days","restore_enabled"}
            or type(value["enabled"]) is not bool or type(value["restore_enabled"]) is not bool
            or type(value["grace_days"]) is not int or not 1<=value["grace_days"]<=30):
        raise RenewalRefused("Invalid lifecycle policy.")
    return value

def policy():
    record=AuditLog.objects.filter(action=POLICY,entity_type="HostingLifecyclePolicy",entity_id="global").order_by("-pk").first()
    return {"revision":record.pk,**validate_policy(unseal(record.details,POLICY))} if record else None

@transaction.atomic
def save_policy(value,actor):
    value=validate_policy(value)
    record=AuditLog.objects.create(actor=actor,action=POLICY,entity_type="HostingLifecyclePolicy",entity_id="global",
        entity_name="Hosting lifecycle",details=seal(value,POLICY))
    from settings_registry.models import EmailTemplate
    for key,name,subject,body in (
        ("hosting_suspended","Hosting suspension","Hosting suspended: {{service.label}}","Hello {{customer.first_name}},\n\nYour hosting service was suspended after its unpaid renewal grace period. Sign in to your account to review your invoice."),
        ("hosting_restored","Hosting restoration","Hosting restored: {{service.label}}","Hello {{customer.first_name}},\n\nYour hosting supplier has confirmed restoration after renewal payment.")):
        EmailTemplate.objects.get_or_create(key=key,defaults={"name":name,"category":"provisioning","subject":subject,"body_text":body,"body_html":"","is_active":False,"is_system":True})
    return {"revision":record.pk,**value}

def current_notice(message):
    import re
    match=re.fullmatch(r"hosting_lifecycle:([1-9][0-9]{0,18}):([a-f0-9]{32}):(suspend|restore)",message.idempotency_key)
    if not match:
        return False
    try:
        service=Service.objects.get(pk=int(match[1]),client__is_active=True,client__email=message.recipient)
        record=service.metadata[FENCE]
        entry=unseal(record["grant"],FENCE)
        operation=match[3]
        return (record["state"]=="confirmed" and entry["service"]==service.pk and entry["owner"]==service.client_id
                and entry["marker"]=="octalve-nonpayment-"+match[2] and entry["operation"]==operation
                and ((operation=="suspend" and service.status=="suspended" and message.template.key=="hosting_suspended")
                     or (operation=="restore" and service.status=="active" and message.template.key=="hosting_restored")))
    except (Service.DoesNotExist,RenewalRefused,KeyError,TypeError,ValueError):
        return False

def _hold(service, *, allow_cancellation=False):
    return bool(service.metadata.get("lifecycle_protection") or service.metadata.get("security_hold")
        or service.metadata.get("abuse_hold") or service.metadata.get("dispute_hold")
        or service.metadata.get("native_resource_mutation_v1",{}).get("state")=="dispatched_uncertain"
        or (not allow_cancellation and (service.metadata.get("hosting_cancellation_v1") or ServiceActionLog.objects.filter(service=service,action="cancel",details__state="pending_review").exists())))

def _authority(service,operation,*,allow_cancellation=False):
    if service.service_type!="hosting" or not service.client.is_active or _hold(service,allow_cancellation=allow_cancellation):
        raise RenewalRefused("Protected or unavailable hosting service.")
    proof=VerifiedHostingBinding.objects.filter(service=service,revoked_at__isnull=True,
        provider_id_snapshot=service.provider_id,confirmation_source="provider_api_readback").first()
    if (not proof or not service.activated_at or proof.confirmed_at<service.activated_at
            or not proof.account_digest or proof.account_digest!=account_digest(service)
            or Service.objects.filter(provider_id=service.provider_id,provider_identifier__iexact=service.provider_identifier).exclude(pk=service.pk).exists()):
        raise RenewalRefused("Current supplier identity unavailable.")
    provider=Provider.objects.get(pk=service.provider_id)
    row,key,p=load_hosting_connection(provider)
    if ("lifecycle_suspend" if operation=="suspend" else "lifecycle_restore") not in p.get("resource_capabilities",[]):
        raise RenewalRefused("Supplier lifecycle capability not approved.")
    task=ProvisioningTask.objects.get(service=service,action="provision",status="completed",
        order_item_id=service.order_item_id,provider_id=provider.pk,metadata__authority="verified_paid_order")
    plan=AccountCreationPlan(task.pk,service.pk,provider.pk,provider.adapter_type,service.provider_identifier,
        service.domain_name,service.provider_package_id,provider.username,service.client.email)
    if task.payload.get("expected_account")!=plan.username or task.payload.get("domain")!=plan.domain or task.payload.get("provider_package_id")!=plan.package:
        raise RenewalRefused("Original provisioning identity changed.")
    return proof,provider,row,PinnedHostingProtocol(plan,row.public_settings["server_url"],provider.username,key,
        bound_origin=(row.public_settings["server_url"],row.public_settings["server_ip"]))

def _invoice(service,invoice,operation,p):
    grant=invoice.metadata.get(RENEWAL_KEY)
    term=unseal(grant,RENEWAL_KEY)
    if (term["invoice"]!=invoice.pk or term["service"]!=service.pk or term["owner"]!=service.client_id
            or invoice.client_id!=service.client_id or invoice.order_id!=term["order"]
            or invoice.order.source!="renewal" or invoice.order.client_id!=service.client_id
            or invoice.order.metadata.get(RENEWAL_KEY)!=grant or str(invoice.total)!=term["total"]
            or invoice.currency!=term["currency"]):
        raise RenewalRefused("Renewal authority changed.")
    if operation=="suspend":
        if (service.status!="active" or not service.auto_renew or service.next_due_date.isoformat()!=term["start"]
                or invoice.due_date!=service.next_due_date or timezone.now()<service.next_due_date+timedelta(days=p["grace_days"])
                or invoice.status!="unpaid" or invoice.amount_paid!=0 or invoice.amount_due!=invoice.total
                or invoice.total<=0 or invoice.order.status!="pending_payment"
                or PaymentIntent.objects.filter(invoice=invoice,status__in=("pending","processing")).exists()
                or Transaction.objects.filter(invoice=invoice).exclude(status__in=("failed","cancelled")).exists()
                or WebhookEvent.objects.filter(is_verified=True,is_processed=False,payload__intent_id__in=list(PaymentIntent.objects.filter(invoice=invoice).values_list("pk",flat=True))).exists()):
            raise RenewalRefused("Unpaid period or payment uncertainty prevents suspension.")
    else:
        if (service.status!="suspended" or service.suspension_reason!="Octalve verified nonpayment"
                or invoice.status!="paid" or invoice.order.status!="provisioned"
                or invoice.metadata.get("renewal_applied") is not True or service.next_due_date.isoformat()!=term["end"]
                or service.next_due_date<=timezone.now() or invoice.amount_paid!=invoice.total or invoice.amount_due!=0):
            raise RenewalRefused("Verified renewal does not authorize restoration.")
        payments=list(Transaction.objects.filter(invoice=invoice,status="successful",transaction_type="payment",
            gateway__status="active",gateway__test_mode=False,client_id=service.client_id,currency=invoice.currency,amount=invoice.total)[:2])
        if len(payments)!=1 or payments[0].metadata.get("provider_api_verified") is not True or payments[0].metadata.get("verified_remote_id")!=payments[0].provider_reference:
            raise RenewalRefused("Independent payment evidence unavailable.")
    return term

def _lock_supplier(expected):
    IntegrationConnection.objects.select_for_update().get(pk=expected["connection"])
    Provider.objects.select_for_update().get(pk=expected["provider"])

def _snapshot(service,invoice,operation,p):
    term=_invoice(service,invoice,operation,p)
    proof,provider,row,protocol=_authority(service,operation)
    return {"service":service.pk,"invoice":invoice.pk,"operation":operation,"owner":service.client_id,
        "binding":str(proof.binding_ref),"digest":proof.account_digest,"policy_revision":p["revision"],
        "provider":provider.pk,"connection":str(row.pk),"version":row.current_version,"term":term["start"]},protocol

@transaction.atomic
def _reserve(service_id,invoice_id,operation,p,expected,marker):
    invoice=Invoice.objects.select_for_update().get(pk=invoice_id)
    service=Service.objects.select_for_update().get(pk=service_id)
    if policy()!=p:
        raise RenewalRefused("Lifecycle policy changed.")
    if service.metadata.get(FENCE,{}).get("state")=="dispatched_uncertain":
        raise RenewalRefused("Prior lifecycle outcome uncertain.")
    _lock_supplier(expected)
    current,protocol=_snapshot(service,invoice,operation,p)

    if current!=expected:
        raise RenewalRefused("Lifecycle authority changed.")
    entry=seal({**current,"marker":marker},FENCE)
    service.metadata={**service.metadata,FENCE:{"state":"dispatched_uncertain","grant":entry}}
    service.save(update_fields=["metadata","updated_at"])
    return protocol

@transaction.atomic
def _complete(service_id,invoice_id,expected,observed):
    invoice=Invoice.objects.select_for_update().get(pk=invoice_id)
    service=Service.objects.select_for_update().get(pk=service_id)
    pending=service.metadata.get(FENCE,{})
    if pending.get("state")!="dispatched_uncertain" or unseal(pending["grant"],FENCE)!=expected:
        raise RenewalRefused("Lifecycle reservation changed.")
    _lock_supplier(expected)
    proof,provider,row,_=_authority(service,expected["operation"])
    if (proof.account_digest!=expected["digest"] or str(proof.binding_ref)!=expected["binding"]
            or provider.pk!=expected["provider"] or str(row.pk)!=expected["connection"] or row.current_version!=expected["version"]):
        raise RenewalRefused("Supplier changed during lifecycle readback.")
    if expected["operation"]=="suspend":
        if observed!={"state":"suspended","reason":expected["marker"]} or service.status!="active":
            raise RenewalRefused("Suspension not independently confirmed.")
        service.status="suspended"
        service.suspension_reason="Octalve verified nonpayment"
        service.suspended_at=timezone.now()
        ServiceSuspension.objects.create(service=service,reason=service.suspension_reason)
        service.metadata={**service.metadata,"nonpayment_suspension":pending["grant"]}
    else:
        if observed!={"state":"active","reason":""} or service.status!="suspended":
            raise RenewalRefused("Restoration not independently confirmed.")
        service.status="active"
        service.suspended_at=None
        service.suspension_reason=None
        ServiceSuspension.objects.filter(service=service,unsuspended_at__isnull=True,reason="Octalve verified nonpayment").update(unsuspended_at=timezone.now())
        proof.confirmed_at=timezone.now()
        proof.save(update_fields=["confirmed_at"])
    service.metadata={**service.metadata,FENCE:{"state":"confirmed","grant":pending["grant"]}}
    service.save(update_fields=["status","suspension_reason","suspended_at","metadata","updated_at"])
    OPanelLaunchGrant.objects.filter(service=service,consumed_at__isnull=True).update(consumed_at=timezone.now())
    ServiceActionLog.objects.create(service=service,action="suspend" if expected["operation"]=="suspend" else "unsuspend",
        is_automatic=True,success=True,details={"invoice_id":invoice.pk,"verified":True})
    from settings_registry.mail_authority import _transactional_event
    operation=expected["operation"]
    _transactional_event(f"hosting_lifecycle:{service.pk}:{expected['marker'].rsplit('-',1)[-1]}:{operation}",
        "hosting_suspended" if operation=="suspend" else "hosting_restored",service.client,
        {"service.label":service.label,"invoice.number":str(invoice.invoice_number)})
    return True

def advance(service_id,invoice_id,operation):
    if not enabled() or operation not in ("suspend","restore"):
        return "disabled"
    try:
        p=policy()
        if not p or not p["enabled"] or (operation=="restore" and not p["restore_enabled"]):
            return "disabled"
        service=Service.objects.get(pk=service_id)
        invoice=Invoice.objects.get(pk=invoice_id)
        pending=service.metadata.get(FENCE,{})
        if pending.get("state")=="dispatched_uncertain":
            expected=unseal(pending["grant"],FENCE)
            if expected["invoice"]!=invoice_id or expected["operation"]!=operation:
                return "held"
            _,_,_,protocol=_authority(service,operation)
            return "confirmed" if _complete(service_id,invoice_id,expected,protocol.lifecycle_state()) else "held"
        snapshot,protocol=_snapshot(service,invoice,operation,p)
        observed=protocol.lifecycle_state()
        if operation=="suspend":
            if observed!={"state":"active","reason":""}:
                return "held"
            marker="octalve-nonpayment-"+uuid.uuid4().hex
        else:
            original=unseal(service.metadata["nonpayment_suspension"],FENCE)
            marker=original["marker"]
            if original["invoice"]!=invoice_id or original["operation"]!="suspend" or observed!={"state":"suspended","reason":marker}:
                return "held"
        protocol=_reserve(service_id,invoice_id,operation,p,snapshot,marker)
        try:
            protocol.lifecycle_write(operation,marker,dispatch_authorized=True)
        except (VendorProtocolRefused,SupplierEgressDenied):
            pass
        return "confirmed" if _complete(service_id,invoice_id,{**snapshot,"marker":marker},protocol.lifecycle_state()) else "held"
    except (RenewalRefused,VendorProtocolRefused,SupplierEgressDenied,VaultUnavailable,DatabaseError,
            Service.DoesNotExist,Invoice.DoesNotExist,Provider.DoesNotExist,IntegrationConnection.DoesNotExist,ProvisioningTask.DoesNotExist,
            ProvisioningTask.MultipleObjectsReturned,KeyError,ValueError,TypeError):
        return "held"

def run_due(limit=2):
    out={"enabled":enabled(),"suspended":0,"restored":0,"held":0}
    if not out["enabled"]:
        return out
    p=policy()
    if not p or not p["enabled"]:
        return out
    limit=min(max(int(limit),1),4)
    # Readback-only recovery precedes new writes, including payment races.
    seen=set()
    for service in Service.objects.filter(metadata__hosting_lifecycle_v1__state="dispatched_uncertain").order_by("updated_at","pk")[:limit]:
        try:
            entry=unseal(service.metadata[FENCE]["grant"],FENCE)
            state=advance(service.pk,entry["invoice"],entry["operation"])
            seen.add(service.pk)
            out[("suspended" if entry["operation"]=="suspend" else "restored") if state=="confirmed" else "held"]+=1
        except (RenewalRefused,KeyError,TypeError):
            out["held"]+=1
    from django.db.models import Exists,OuterRef
    from billing.models import InvoiceItem
    eligible_items=InvoiceItem.objects.filter(invoice_id=OuterRef("pk"),service_id__in=Service.objects.filter(status="active",auto_renew=True).values("pk"))
    for invoice in Invoice.objects.filter(status="unpaid",order__source="renewal",metadata__has_key=RENEWAL_KEY,
            due_date__lte=timezone.now()-timedelta(days=p["grace_days"])).annotate(eligible_service=Exists(eligible_items)).filter(eligible_service=True).order_by("due_date","pk")[:limit]:
        pk=invoice.metadata.get("service_id")
        if pk and pk not in seen:
            state=advance(pk,invoice.pk,"suspend")
            out["suspended" if state=="confirmed" else "held"]+=1
    if p["restore_enabled"]:
        for service in Service.objects.filter(status="suspended",suspension_reason="Octalve verified nonpayment",
                next_due_date__gt=timezone.now(),metadata__has_key="nonpayment_suspension").order_by("updated_at","pk")[:limit]:
            if service.pk in seen:
                continue
            try:
                invoice_id=unseal(service.metadata["nonpayment_suspension"],FENCE)["invoice"]
                state=advance(service.pk,invoice_id,"restore")
                out["restored" if state=="confirmed" else "held"]+=1
            except (RenewalRefused,KeyError,TypeError):
                out["held"]+=1
    return out
