"""Paid-term cancellation and separately approved permanent account removal.

No registrar operation. A supplier account deletion is never inferred from a
request, an expired service, a timeout or a local status. Cancellation keeps
the supplier account suspended until a separately authorized retention review.
"""
from datetime import timedelta
import uuid
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction,DatabaseError
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from billing.models import Invoice
from payments.models import PaymentIntent,Transaction
from providers.connection_vault import VaultUnavailable
from providers.pinned_egress import SupplierEgressDenied
from provisioning.hosting_vendor_protocol import VendorProtocolRefused
from opanel_bridge.models import OPanelLaunchGrant
from settings_registry.models import ConsoleMailOutbox,EmailTemplate
from settings_registry.mail_authority import _transactional_event
from .models import Service,ServiceActionLog
from .renewals import seal,unseal,RenewalRefused
from . import hosting_lifecycle as lifecycle

KEY="hosting_cancellation_v1"
POLICY="hosting_cancellation_policy_v1"

def enabled():
    return bool(lifecycle.enabled() and getattr(settings,"CLOUD_HOSTING_CANCELLATION_ENABLED",False))

def validate_policy(p):
    if (not isinstance(p,dict) or set(p)!={"enabled","retention_days","termination_enabled"}
            or type(p["enabled"]) is not bool or type(p["termination_enabled"]) is not bool
            or type(p["retention_days"]) is not int or not 30<=p["retention_days"]<=365):
        raise RenewalRefused("Invalid cancellation retention policy.")
    return p

def policy():
    from audit.models import AuditLog
    row=AuditLog.objects.filter(action=POLICY,entity_type="HostingCancellationPolicy",entity_id="global").order_by("-pk").first()
    return {"revision":row.pk,**validate_policy(unseal(row.details,POLICY))} if row else None

@transaction.atomic
def save_policy(value,actor):
    from audit.models import AuditLog
    value=validate_policy(value)
    row=AuditLog.objects.create(actor=actor,action=POLICY,entity_type="HostingCancellationPolicy",
        entity_id="global",entity_name="Hosting cancellation policy",details=seal(value,POLICY))
    # Existing operator text/activation is never overwritten.
    for key,name,subject,body in (
        ("hosting_cancellation_notice","Hosting cancellation notice","Scheduled cancellation of {{service.label}}",
         "Hello {{customer.first_name}},\n\nYour hosting cancellation is scheduled for {{service.renewal_date}}. Save your data and contact support if this is incorrect."),
        ("hosting_termination_notice","Hosting termination notice","Permanent removal review for {{service.label}}",
         "Hello {{customer.first_name}},\n\nYour cancelled hosting is in retention. Permanent removal may occur only after the approved retention and backup review. Contact support promptly if you need your data.")):
        EmailTemplate.objects.get_or_create(key=key,defaults={"name":name,"category":"provisioning",
            "subject":subject,"body_text":body,"body_html":"","is_active":False,"is_system":True})
    return {"revision":row.pk,**value}

def _context(service):
    return {"service.label":service.label,"service.renewal_date":timezone.localtime(service.next_due_date).strftime("%d %b %Y")}

def _notice(service,entry,kind):
    return _transactional_event(f"hosting_cancel:{service.pk}:{entry['event']}:{kind}",
        "hosting_cancellation_notice" if kind=="cancel" else "hosting_termination_notice",service.client,_context(service))

def _notice_accepted(service,entry,kind):
    return ConsoleMailOutbox.objects.filter(idempotency_key=f"hosting_cancel:{service.pk}:{entry['event']}:{kind}",
        recipient=service.client.email,status="sent",provider_receipt__isnull=False).exclude(provider_receipt="").exists()

def _protected(service):
    return any(service.metadata.get(k) for k in ("lifecycle_protection","security_hold","abuse_hold","dispute_hold")) or (
        service.metadata.get("native_resource_mutation_v1",{}).get("state")=="dispatched_uncertain"
        or service.metadata.get(lifecycle.FENCE,{}).get("state")=="dispatched_uncertain")

def _unresolved(service):
    invoices=Invoice.objects.filter(client_id=service.client_id,metadata__type="renewal",metadata__service_id=service.pk)
    original=Transaction.objects.filter(invoice_id=service.invoice_id)
    if original.filter(status__in=("manual_review","pending","refunded")).exists() or original.filter(transaction_type="refund").exists():
        return True
    return (invoices.filter(status__in=("unpaid","partially_paid","overdue")).exists()
        or invoices.filter(status="paid",order__status="paid").exists()
        or PaymentIntent.objects.filter(invoice__in=invoices,status__in=("pending","processing")).exists()
        or Transaction.objects.filter(invoice__in=invoices,status__in=("manual_review","pending","refunded")).exists())

def _entry(service):
    record=service.metadata.get(KEY,{})
    return unseal(record["grant"],KEY),record

def _identity(service,entry):
    if (entry["service"]!=service.pk or entry["owner"]!=service.client_id
            or entry["term"]!=service.next_due_date.isoformat() or _protected(service) or _unresolved(service)):
        raise RenewalRefused("Cancellation scope or protection changed.")
    proof,provider,row,protocol=lifecycle._authority(service,"suspend",allow_cancellation=True)
    if (entry["binding"]!=str(proof.binding_ref) or entry["digest"]!=proof.account_digest
            or entry["provider"]!=provider.pk or entry["connection"]!=str(row.pk)
            or entry["version"]!=row.current_version):
        raise RenewalRefused("Cancellation supplier authority changed.")
    return proof,provider,row,protocol

@transaction.atomic
def approve(service_id,request_id,actor):
    if not enabled():
        raise RenewalRefused("Cancellation worker disabled.")
    p=policy()
    if not p or not p["enabled"]:
        raise RenewalRefused("Cancellation policy not approved.")
    service=Service.objects.select_for_update().get(pk=service_id)
    record=ServiceActionLog.objects.select_for_update().get(pk=request_id,service=service,action="cancel",details__state="pending_review")
    if record.performed_by_id!=service.client_id or service.status!="active" or _protected(service) or _unresolved(service) or KEY in service.metadata:
        raise RenewalRefused("Cancellation needs financial or customer review.")
    proof,provider,row,_=lifecycle._authority(service,"suspend",allow_cancellation=True)
    entry={"event":uuid.uuid4().hex,"service":service.pk,"owner":service.client_id,
        "request":record.pk,"term":service.next_due_date.isoformat(),"binding":str(proof.binding_ref),
        "digest":proof.account_digest,"provider":provider.pk,"connection":str(row.pk),"version":row.current_version,
        "retention_days":p["retention_days"],"policy_revision":p["revision"]}
    service.auto_renew=False
    service.metadata={**service.metadata,KEY:{"state":"scheduled","grant":seal(entry,KEY)}}
    service.save(update_fields=["auto_renew","metadata","updated_at"])
    record.details={**record.details,"state":"approved_scheduled","approved_by":actor.pk}
    record.success=True
    record.save(update_fields=["details","success"])
    _notice(service,entry,"cancel")
    return {"state":"scheduled","effective_at":entry["term"],"retention_days":entry["retention_days"]}

@transaction.atomic
def _reserve(service_id,expected,state,next_state,expected_policy):
    service=Service.objects.select_for_update().get(pk=service_id)
    entry,record=_entry(service)
    if entry!=expected or record["state"]!=state:
        raise RenewalRefused("Cancellation reservation changed.")
    lifecycle._lock_supplier(entry)
    proof,provider,row,protocol=_identity(service,entry)
    if policy()!=expected_policy:
        raise RenewalRefused("Cancellation policy changed.")
    if state=="scheduled":
        if service.status!="active" or timezone.now()<service.next_due_date or not _notice_accepted(service,entry,"cancel"):
            raise RenewalRefused("Paid term or cancellation notice prevents suspension.")
    elif state=="termination_approved":
        approval=unseal(record["approval"],KEY+":removal")
        expiry=parse_datetime(approval["expires"])
        _,_,supplier_policy=lifecycle.load_hosting_connection(provider)
        if (not expected_policy["termination_enabled"] or not getattr(settings,"CLOUD_HOSTING_TERMINATION_ENABLED",False)
                or not expiry or expiry<=timezone.now() or approval["service"]!=service.pk or approval["domain"]!=service.domain_name
                or approval["event"]!=entry["event"] or "lifecycle_terminate" not in supplier_policy.get("resource_capabilities",[])
                or service.status!="cancelled" or not service.cancelled_at
                or timezone.now()<service.cancelled_at+timedelta(days=max(entry["retention_days"],expected_policy["retention_days"]))
                or not _notice_accepted(service,entry,"terminate")):
            raise RenewalRefused("Removal approval changed.")
    else:
        raise RenewalRefused("Unapproved cancellation operation.")
    service.metadata={**service.metadata,KEY:{**record,"state":next_state}}
    service.save(update_fields=["metadata","updated_at"])
    return protocol

@transaction.atomic
def _finish(service_id,expected,operation,observed):
    service=Service.objects.select_for_update().get(pk=service_id)
    entry,record=_entry(service)
    if entry!=expected or record["state"]!=("suspend_uncertain" if operation=="cancel" else "terminate_uncertain"):
        raise RenewalRefused("Cancellation reservation changed.")
    lifecycle._lock_supplier(entry)
    proof,provider,row,_=_identity(service,entry)
    if operation=="cancel":
        if observed!={"state":"suspended","reason":"octalve-cancellation-"+entry["event"]}:
            raise RenewalRefused("Cancellation suspension unconfirmed.")
        service.status="cancelled"
        service.cancelled_at=timezone.now()
        service.metadata={**service.metadata,KEY:{**record,"state":"retained","retained_at":service.cancelled_at.isoformat()}}
        service.save(update_fields=["status","cancelled_at","metadata","updated_at"])
        _notice(service,entry,"terminate")
    else:
        if observed is not True:
            raise RenewalRefused("Supplier absence unconfirmed.")
        service.status="terminated"
        service.terminated_at=timezone.now()
        service.metadata={**service.metadata,KEY:{**record,"state":"terminated"}}
        service.save(update_fields=["status","terminated_at","metadata","updated_at"])
        proof.revoked_at=timezone.now()
        proof.save(update_fields=["revoked_at"])
    OPanelLaunchGrant.objects.filter(service=service,consumed_at__isnull=True).update(consumed_at=timezone.now())
    ServiceActionLog.objects.create(service=service,action="cancel" if operation=="cancel" else "terminate",
        success=True,is_automatic=True,details={"verified":True,"request_id":entry["request"]})
    return True

@transaction.atomic
def authorize_removal(service_id,actor,confirmed_domain,backup_reference):
    """MFA caller separately attests a recoverable offsite backup and exact domain."""
    if not enabled() or not getattr(settings,"CLOUD_HOSTING_TERMINATION_ENABLED",False):
        raise RenewalRefused("Permanent removal disabled.")
    p=policy()
    if not p or not p["enabled"] or not p["termination_enabled"]:
        raise RenewalRefused("Permanent removal policy disabled.")
    service=Service.objects.select_for_update().get(pk=service_id)
    entry,record=_entry(service)
    if (service.status!="cancelled" or record["state"] not in ("retained","termination_approved") or confirmed_domain!=service.domain_name
            or not isinstance(backup_reference,str) or not 8<=len(backup_reference)<=100
            or any(not (ch.isalnum() or ch in "-_.:") for ch in backup_reference)
            or not service.cancelled_at or timezone.now()<service.cancelled_at+timedelta(days=max(entry["retention_days"],p["retention_days"]))
            or not _notice_accepted(service,entry,"terminate")):
        raise RenewalRefused("Retention, notice and backup confirmation required.")
    _,provider,_,_=_identity(service,entry)
    _,_,supplier_policy=lifecycle.load_hosting_connection(provider)
    if "lifecycle_terminate" not in supplier_policy.get("resource_capabilities",[]):
        raise RenewalRefused("Supplier removal is not approved.")
    approval={"event":entry["event"],"service":service.pk,"domain":service.domain_name,"actor":actor.pk,
        "backup_reference":backup_reference,"expires":(timezone.now()+timedelta(days=2)).isoformat()}
    service.metadata={**service.metadata,KEY:{**record,"state":"termination_approved","approval":seal(approval,KEY+":removal")}}
    service.save(update_fields=["metadata","updated_at"])
    return {"state":"termination_approved"}

def current_notice(message):
    import re
    match=re.fullmatch(r"hosting_cancel:([1-9][0-9]{0,18}):([a-f0-9]{32}):(cancel|terminate)",message.idempotency_key)
    if not match:
        return False
    try:
        service=Service.objects.get(pk=int(match[1]),client__is_active=True,client__email=message.recipient)
        entry,record=_entry(service)
        return entry["event"]==match[2] and ((match[3]=="cancel" and message.template.key=="hosting_cancellation_notice" and record["state"]=="scheduled")
            or (match[3]=="terminate" and message.template.key=="hosting_termination_notice" and record["state"]=="retained"))
    except (Service.DoesNotExist,RenewalRefused,KeyError,TypeError,ValueError):
        return False

def advance(service_id):
    if not enabled():
        return "disabled"
    try:
        p=policy()
        if not p or not p["enabled"]:
            return "disabled"
        service=Service.objects.get(pk=service_id)
        entry,record=_entry(service)
        _,provider,row,protocol=_identity(service,entry)
        marker="octalve-cancellation-"+entry["event"]
        state=record["state"]
        if state=="scheduled":
            _notice(service,entry,"cancel")
            if timezone.now()<service.next_due_date or not _notice_accepted(service,entry,"cancel") or service.status!="active":
                return "waiting"
            if protocol.lifecycle_state()!={"state":"active","reason":""}:
                return "held"
            protocol=_reserve(service.pk,entry,state,"suspend_uncertain",p)
            try:
                protocol.lifecycle_write("suspend",marker,dispatch_authorized=True)
            except (VendorProtocolRefused,SupplierEgressDenied):
                pass
            state="suspend_uncertain"
        if state=="suspend_uncertain":
            return "cancelled" if _finish(service.pk,entry,"cancel",protocol.lifecycle_state()) else "held"
        if state=="retained":
            _notice(service,entry,"terminate")
            return "waiting"
        if state=="termination_approved":
            if not getattr(settings,"CLOUD_HOSTING_TERMINATION_ENABLED",False) or not p["termination_enabled"]:
                return "held"
            approval=unseal(record["approval"],KEY+":removal")
            expiry=parse_datetime(approval["expires"])
            _,_,supplier_policy=lifecycle.load_hosting_connection(provider)
            if (not expiry or expiry<=timezone.now() or approval["event"]!=entry["event"]
                    or approval["service"]!=service.pk or approval["domain"]!=service.domain_name
                    or "lifecycle_terminate" not in supplier_policy.get("resource_capabilities",[])
                    or not service.cancelled_at or timezone.now()<service.cancelled_at+timedelta(days=max(entry["retention_days"],p["retention_days"]))
                    or not _notice_accepted(service,entry,"terminate") or protocol.lifecycle_state()!={"state":"suspended","reason":marker}):
                return "held"
            protocol=_reserve(service.pk,entry,state,"terminate_uncertain",p)
            try:
                protocol.terminate_account(dispatch_authorized=True)
            except (VendorProtocolRefused,SupplierEgressDenied):
                pass
            state="terminate_uncertain"
        if state=="terminate_uncertain":
            return "terminated" if _finish(service.pk,entry,"terminate",protocol.absent()) else "held"
        return "waiting"
    except (RenewalRefused,VendorProtocolRefused,VaultUnavailable,SupplierEgressDenied,DatabaseError,
            Service.DoesNotExist,KeyError,TypeError,ValueError):
        return "held"

def run_due(limit=2):
    result={"enabled":enabled(),"cancelled":0,"terminated":0,"held":0}
    if not result["enabled"]:
        return result
    from django.db.models import Q
    # Notice repair is bounded and does not compete with actual due transitions.
    for service in Service.objects.filter(metadata__hosting_cancellation_v1__state="retained").order_by("-cancelled_at")[:limit]:
        try:
            entry,_=_entry(service)
            _notice(service,entry,"terminate")
        except (RenewalRefused,KeyError,TypeError):
            pass
    due=Service.objects.filter(Q(metadata__hosting_cancellation_v1__state="scheduled",next_due_date__lte=timezone.now()) | Q(metadata__hosting_cancellation_v1__state__in=("suspend_uncertain","termination_approved","terminate_uncertain")))
    for pk in due.order_by("updated_at","pk").values_list("pk",flat=True)[:min(max(int(limit),1),4)]:
        state=advance(pk)
        if state in ("cancelled","terminated","held"):
            result[state]+=1
    return result
