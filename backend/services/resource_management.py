"""Service-scoped resource authority and durable mutation reservations.

The existing Service row is the reservation fence, not a second hosting
identity store. Only redacted operation identity is persisted. An uncertain
supplier write blocks further mutations until an independent reconciliation.
"""
import uuid
from datetime import timedelta
from django.utils.dateparse import parse_datetime
from dataclasses import dataclass
from django.conf import settings
from django.db import DatabaseError, transaction
from django.utils import timezone
from django.views.decorators.debug import sensitive_variables
from accounts.security_throttle import _spend
from audit.models import AuditLog
from opanel_bridge.policy import eligible, refresh_candidate, account_digest
from opanel_bridge.readback import refresh_owned_entitlement, verify_existing_account, ReadbackRejected
from providers.connection_models import IntegrationConnection
from providers.connection_vault import VaultUnavailable
from providers.hosting_runtime import load_hosting_connection
from providers.models import Provider
from providers.pinned_egress import SupplierEgressDenied
from .models import Service
from .resource_protocol import ResourceProtocol, ResourceRefused, mailbox_name

FENCE = "native_resource_mutation_v1"


@dataclass(frozen=True)
class Authority:
    service: object
    proof_id: int
    digest: str
    provider: object
    row: object
    protocol: object


def enabled():
    return bool(getattr(settings,"CLOUD_HOSTING_NATIVE_RESOURCES_ENABLED",False))


def capabilities(service):
    """Read-only capability status; no claim of external operation success."""
    if not enabled() or not (eligible(service.client_id,service.pk) or refresh_candidate(service.client_id,service.pk)):
        return []
    try:
        provider=Provider.objects.get(pk=service.provider_id)
        _,_,policy=load_hosting_connection(provider)
        return list(policy.get("resource_capabilities",[]))
    except (Provider.DoesNotExist,VaultUnavailable,DatabaseError,AttributeError):
        return []


@sensitive_variables("key")
def authority(subject, service_id, operation, *, refresh=True):
    if not enabled():
        raise ResourceRefused("Native hosting resources unavailable.")
    found=eligible(subject,service_id)
    if not found and refresh:
        found=refresh_owned_entitlement(subject,service_id)
    if not found:
        raise ResourceRefused("Hosting entitlement unavailable.")
    service,proof=found
    try:
        provider=Provider.objects.get(pk=service.provider_id)
        row,key,policy=load_hosting_connection(provider)
        if operation not in policy.get("resource_capabilities",[]):
            raise ResourceRefused("Supplier capability unavailable.")
        return Authority(service,proof.pk,proof.account_digest,provider,row,
                         ResourceProtocol(service,provider,row,key))
    except (Provider.DoesNotExist,VaultUnavailable,AttributeError,KeyError):
        raise ResourceRefused("Supplier authority unavailable.") from None


def _same(expected, current):
    return (expected.service.pk==current.service.pk
        and expected.service.client_id==current.service.client_id
        and expected.service.provider_id==current.service.provider_id
        and expected.service.provider_identifier==current.service.provider_identifier
        and expected.service.provider_package_id==current.service.provider_package_id
        and expected.service.domain_name==current.service.domain_name
        and expected.proof_id==current.proof_id
        and expected.digest==current.digest
        and expected.row.pk==current.row.pk
        and expected.row.current_version==current.row.current_version
        and expected.provider.config==current.provider.config)


def _current(expected,operation):
    fresh=authority(expected.service.client_id,expected.service.pk,operation,refresh=False)
    if not _same(expected,fresh):
        raise ResourceRefused("Hosting authority changed.")
    return fresh


def _budget(subject, *, write=False):
    if _spend("hosting:resource_write" if write else "hosting:resource_read",
              str(subject), 4 if write else 20, 300 if write else 60):
        raise ResourceRefused("Hosting resource requests temporarily limited.")


def list_resources(subject,service_id,resource):
    operation={"email":"mailbox_read","subdomains":"subdomain_read"}.get(resource)
    if not operation:
        raise ResourceRefused("Resource unavailable.")
    _budget(subject)
    a=authority(subject,service_id,operation)
    verify_existing_account(a.service,a.provider)
    a=_current(a,operation)
    rows=a.protocol.mailboxes() if resource=="email" else a.protocol.subdomains()
    fresh=_current(a,operation)
    return {"resource":resource,"domain":a.service.domain_name,"items":rows,
            "pending_operation":fresh.service.metadata.get(FENCE,{}).get("state")=="dispatched_uncertain",
            "verified_at":timezone.now().isoformat()}


def _lock(expected,operation):
    # Same ordering as current vault readback: Service -> connection -> Provider.
    service=Service.objects.select_for_update().get(pk=expected.service.pk)
    IntegrationConnection.objects.select_for_update().get(pk=expected.row.pk)
    Provider.objects.select_for_update().get(pk=expected.provider.pk)
    current=_current(expected,operation)
    if service.client_id!=expected.service.client_id or account_digest(service)!=expected.digest:
        raise ResourceRefused("Hosting authority changed.")
    return service,current


def _record(service, operation, state, event, *, actor_id):
    AuditLog.objects.create(actor_id=actor_id,action="hosting_resource_"+state,
        entity_type="Service",entity_id=str(service.pk),entity_name=operation,
        details={"operation_id":event,"state":state})


def _finish(expected,event,state):
    with transaction.atomic():
        service,_=_lock(expected,"mailbox_create")
        metadata=service.metadata
        pending=metadata.get(FENCE,{})
        if pending.get("id")!=event or pending.get("state")!="dispatched_uncertain":
            raise ResourceRefused("Resource reservation changed.")
        service.metadata={**metadata,FENCE:{**pending,"state":state,"updated_at":timezone.now().isoformat()}}
        service.save(update_fields=["metadata"])
        _record(service,"mailbox_create",state,event,actor_id=service.client_id)


@sensitive_variables("password")
def create_mailbox(subject,service_id,*,local,password,quota):
    mailbox_name(local)
    if (not isinstance(password,str) or not 16<=len(password)<=128
            or any(ord(c)<33 or ord(c)>126 for c in password)
            or type(quota) is not int or not 1<=quota<=1000000):
        raise ResourceRefused("Invalid mailbox fields.")
    _budget(subject,write=True)
    a=authority(subject,service_id,"mailbox_create")
    if local==a.service.provider_identifier.lower():
        raise ResourceRefused("Reserved account name.")
    # Reject stale service proof, then query exact current account and capacity.
    verify_existing_account(a.service,a.provider)
    a=_current(a,"mailbox_create")
    address=local+"@"+a.service.domain_name
    previous_fence=a.service.metadata.get(FENCE)
    current_rows=a.protocol.mailboxes()
    if any(x["address"]==address for x in current_rows):
        raise ResourceRefused("Mailbox already exists.")
    count,limit,disk=a.protocol.mailbox_capacity()
    if (count<len(current_rows) or (limit is not None and count>=limit)
            or (disk is not None and quota>disk)):
        raise ResourceRefused("Hosting resource limit reached.")
    event=str(uuid.uuid4())
    with transaction.atomic():
        service,a=_lock(a,"mailbox_create")
        prior=service.metadata.get(FENCE)
        if prior!=previous_fence:
            raise ResourceRefused("Hosting resource state changed. Refresh before retrying.")
        if prior and prior.get("state")!="confirmed":
            # No blind retry, even for a different local name, while a
            # potentially dispatched write remains uncertain.
            raise ResourceRefused("A previous hosting operation requires reconciliation.")
        service.metadata={**service.metadata,FENCE:{
            "id":event,"operation":"mailbox_create","address":address,"quota_mb":quota,
            "binding":a.digest,"state":"dispatched_uncertain","created_at":timezone.now().isoformat()}}
        service.save(update_fields=["metadata"])
        _record(service,"mailbox_create","reserved",event,actor_id=subject)
    try:
        a=_current(a,"mailbox_create")
        a.protocol.create_mailbox(local,password,quota)
        confirmed=a.protocol.mailboxes()
        if not any(x["address"]==address and x["quota_mb"]==quota and not x["unlimited"] for x in confirmed):
            raise ResourceRefused("Supplier result not independently confirmed.")
        _finish(a,event,"confirmed")
        return {"state":"confirmed","operation_id":event,"address":address}
    except (ResourceRefused,ReadbackRejected,SupplierEgressDenied,VaultUnavailable,DatabaseError,
            Service.DoesNotExist,IntegrationConnection.DoesNotExist,Provider.DoesNotExist):
        # The reservation was committed before external I/O. Retain it even
        # if the process crashes or later database commit is unavailable.
        return {"state":"pending_verification","operation_id":event}


def reconcile_mailbox(subject,service_id):
    """Read back only; do not submit another password-bearing operation."""
    _budget(subject,write=True)
    a=authority(subject,service_id,"mailbox_create")
    pending=a.service.metadata.get(FENCE,{})
    if (pending.get("state")!="dispatched_uncertain" or pending.get("operation")!="mailbox_create"
            or pending.get("binding")!=a.digest):
        raise ResourceRefused("No eligible pending mailbox operation.")
    created=parse_datetime(pending.get("created_at",""))
    if not created or timezone.is_naive(created) or timezone.now()-created<timedelta(minutes=2):
        return {"state":"pending_verification","operation_id":pending["id"]}
    verify_existing_account(a.service,a.provider)
    a=_current(a,"mailbox_create")
    rows=a.protocol.mailboxes()
    if not any(x["address"]==pending.get("address") and x["quota_mb"]==pending.get("quota_mb")
               and not x["unlimited"] for x in rows):
        return {"state":"pending_verification","operation_id":pending["id"]}
    # Readback confirms resource existence/quota, NOT whether the submitted
    # password was applied. Customer must verify/reset the mailbox password.
    _finish(a,pending["id"],"confirmed")
    return {"state":"confirmed","operation_id":pending["id"],"address":pending["address"],
            "password_status":"unverified"}
