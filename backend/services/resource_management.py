"""Service-scoped resource authority and durable mutation reservations.

The existing Service row is the reservation fence, not a second hosting
identity store. Only redacted operation identity is persisted. An uncertain
supplier write blocks further mutations until an independent reconciliation.
"""
import uuid
import hashlib
import json
import hmac
from providers.connection_audit import audit_keyring
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
from .resource_protocol import DB_PROFILES,  ResourceProtocol, ResourceRefused, mailbox_name, subdomain_label, database_suffix, strong_password, forwarding_destination, reply_text

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


def database_initial_user_required(service):
    return Provider.objects.filter(pk=service.provider_id,adapter_type="DirectAdminAdapter").exists()


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
    operation={"ssl":"ssl_readiness","backups":"backup_read","files":"file_root_read","email":"mailbox_read","subdomains":"subdomain_read","databases":"database_read","credentials":"hosting_password","db_users":"database_user_read","forwarders":"forwarder_read","autoresponders":"autoresponder_read"}.get(resource)
    if not operation:
        raise ResourceRefused("Resource unavailable.")
    _budget(subject)
    a=authority(subject,service_id,operation)
    verify_existing_account(a.service,a.provider)
    a=_current(a,operation)
    from .hosting_health import ssl_readiness
    rows={"ssl":lambda:[],"backups":lambda:[],"files":a.protocol.website_files,"email":a.protocol.mailboxes,"subdomains":a.protocol.subdomains,"databases":a.protocol.databases,"credentials":lambda:[],"db_users":a.protocol.all_database_users,"forwarders":a.protocol.forwarders,"autoresponders":a.protocol.autoresponders}[resource]()
    health=ssl_readiness(a.protocol) if resource=="ssl" else a.protocol.backup_inventory() if resource=="backups" else None
    owned_databases=a.protocol.databases() if resource=="db_users" else None
    owned_mailboxes=[x["address"] for x in a.protocol.mailboxes()] if resource in ("forwarders","autoresponders") else None
    fresh=_current(a,operation)
    return {"resource":resource,**({"health":health} if health is not None else {}),**({"mailboxes":owned_mailboxes} if owned_mailboxes is not None else {}),**({"databases":owned_databases} if owned_databases is not None else {}),"domain":a.service.domain_name,"items":rows,
            "pending_operation":fresh.service.metadata.get(FENCE,{}).get("state")=="dispatched_uncertain",
            "pending_password_verification":fresh.service.metadata.get(FENCE,{}).get("state")=="dispatched_uncertain" and fresh.service.metadata.get(FENCE,{}).get("operation") in ("mailbox_password","hosting_password","database_user_password"),
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


def _finish(expected,event,state,operation="mailbox_create"):
    with transaction.atomic():
        service,_=_lock(expected,operation)
        metadata=service.metadata
        pending=metadata.get(FENCE,{})
        if pending.get("id")!=event or pending.get("operation")!=operation or pending.get("state")!="dispatched_uncertain":
            raise ResourceRefused("Resource reservation changed.")
        service.metadata={**metadata,FENCE:{**{k:v for k,v in pending.items() if k!="password_receipt"},"state":state,"updated_at":timezone.now().isoformat()}}
        service.save(update_fields=["metadata"])
        _record(service,operation,state,event,actor_id=service.client_id)


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


# Mutations with objectively observable resource state. Password changes
# require a distinct authentication proof; existence alone is insufficient.
@sensitive_variables("password","keys")
def _password_receipt(event,password,*,key_id=None):
    active,keys=audit_keyring()
    key_id=key_id or active
    try:
        digest=hmac.new(keys[key_id],("native-mailbox-password-v1:"+event+":"+password).encode(),hashlib.sha256).hexdigest()
    except (KeyError,TypeError,ValueError):
        raise ResourceRefused("Password verification authority unavailable.") from None
    return {"key_id":key_id,"mac":digest}


@sensitive_variables("password")
def _same_password(pending,password):
    receipt=pending.get("password_receipt")
    if not isinstance(receipt,dict) or not isinstance(password,str) or not 16<=len(password)<=128:
        return False
    current=_password_receipt(pending["id"],password,key_id=receipt.get("key_id"))
    return hmac.compare_digest(current["mac"],receipt.get("mac",""))


@sensitive_variables("subject","body")
def _reply_digest(subject,body):
    return hashlib.sha256(json.dumps(["native-reply-v1",subject,body],ensure_ascii=False,separators=(",",":")).encode("utf-8")).hexdigest()


OBSERVABLE_MUTATIONS = {"mailbox_delete","mailbox_quota","subdomain_create","subdomain_delete","mailbox_password","database_create","database_delete","hosting_password","database_user_create","database_user_delete","database_grants","database_user_password","forwarder_create","forwarder_delete","autoresponder_delete","autoresponder_create","autoresponder_edit"}


@sensitive_variables("password","subject","body")
def _observed(protocol, pending, password=None):
    operation=pending["operation"]
    target=pending["address"]
    if operation=="autoresponder_delete":
        return target not in protocol.autoresponders()
    if operation in ("autoresponder_create","autoresponder_edit"):
        if target not in protocol.autoresponders():
            return False
        subject,body=protocol.autoresponder_content(target.split("@")[0])
        return _same_password(pending,_reply_digest(subject,body))
    if operation.startswith("forwarder_"):
        rows=[x for x in protocol.forwarders() if x["address"]==target]
        return (len(rows)==1 and rows[0]["managed"] and rows[0]["destination"]==pending["destination"]) if operation=="forwarder_create" else not rows
    if operation=="hosting_password":
        return _same_password(pending,password) and protocol.verify_hosting_password(password)
    if operation.startswith("mailbox_"):
        rows=protocol.mailboxes()
        matching=[x for x in rows if x["address"]==target]
        if operation=="mailbox_delete":
            return not matching
        if operation=="mailbox_password":
            return (len(matching)==1 and matching[0]["quota_mb"]==pending["quota_mb"]
                    and matching[0]["unlimited"]==pending["unlimited"]
                    and _same_password(pending,password) and protocol.verify_mailbox_password(target.split("@")[0],password))
        return len(matching)==1 and matching[0]["quota_mb"]==pending["quota_mb"] and not matching[0]["unlimited"]
    if operation=="database_user_password":
        db=pending.get("database")
        members=protocol.database_users(db) if db is not None else protocol.all_database_users()
        return target in members and _same_password(pending,password) and protocol.verify_database_user_password(target,password,db)
    if operation in ("database_user_create","database_user_delete","database_grants"):
        db=pending.get("database")
        if operation=="database_grants":
            return protocol.database_grants(db,target)==sorted(DB_PROFILES[pending["profile"]])
        rows=protocol.database_users(db) if db is not None else protocol.all_database_users()
        return (target in rows) if operation=="database_user_create" else (target not in rows)
    if operation.startswith("database_"):
        rows=protocol.databases()
        if operation=="database_delete":
            return target not in rows
        if target not in rows:
            return False
        initial=pending.get("initial_user")
        return initial is None or initial in protocol.database_users(target)
    return protocol.subdomain_created(target) if operation=="subdomain_create" else target not in protocol.subdomains()


@sensitive_variables("password","reply_subject","reply_body")
def mutate_resource(subject,service_id,*,operation,local,quota=None,confirm_target=None,password=None,initial_user=None,database_name=None,profile=None,destination=None,reply_subject=None,reply_body=None):
    if operation not in OBSERVABLE_MUTATIONS:
        raise ResourceRefused("Unknown resource operation.")
    forwarder=operation.startswith("forwarder_")
    autoresponder=operation.startswith("autoresponder_")
    mailbox=operation.startswith("mailbox_") or forwarder or autoresponder
    database=operation.startswith("database_")
    hosting=operation=="hosting_password"
    if hosting:
        if local!="":
            raise ResourceRefused("Hosting account identity is server assigned.")
        strong_password(password)
    elif not database:
        (mailbox_name if mailbox else subdomain_label)(local)
    elif operation in ("database_create","database_user_create"):
        database_suffix(local)
    _budget(subject,write=True)
    a=authority(subject,service_id,operation)
    if mailbox and local==a.service.provider_identifier.lower():
        raise ResourceRefused("Reserved account name.")
    target=a.protocol.account if hosting else (a.protocol.database_name(local) if operation in ("database_create","database_user_create") else a.protocol._db_identity(local)) if database else local+("@" if mailbox else ".")+a.service.domain_name
    if forwarder:
        forwarding_destination(destination)
        if destination.split("@")[1]==a.protocol.domain:
            raise ResourceRefused("Local forwarding chains are not managed.")
    if operation=="forwarder_delete" and confirm_target!=target+" -> "+destination:
        raise ResourceRefused("Confirm the exact forwarding route.")
    if operation.endswith("_delete") and not forwarder and confirm_target!=(target+" @ "+database_name if operation=="database_user_delete" and isinstance(database_name,str) else target):
        raise ResourceRefused("Confirm the exact resource being removed.")
    if operation=="mailbox_quota" and (type(quota) is not int or not 1<=quota<=1000000):
        raise ResourceRefused("Invalid mailbox quota.")
    if operation=="mailbox_password" and (not isinstance(password,str) or not 16<=len(password)<=128 or any(ord(c)<33 or ord(c)>126 for c in password)):
        raise ResourceRefused("Invalid mailbox password.")
    verify_existing_account(a.service,a.provider)
    a=_current(a,operation)
    previous=a.service.metadata.get(FENCE)
    if previous and previous.get("state")!="confirmed":
        raise ResourceRefused("A previous operation requires reconciliation.")
    if hosting:
        pass
    elif autoresponder:
        rows=a.protocol.autoresponders()
        if operation=="autoresponder_create":
            if target in rows:
                raise ResourceRefused("Autoresponder already exists.")
        elif target not in rows:
            raise ResourceRefused("Autoresponder not independently identified.")
        if operation!="autoresponder_delete":
            reply_text(reply_subject,reply_body)
            if target not in [x["address"] for x in a.protocol.mailboxes()]:
                raise ResourceRefused("Mailbox not independently identified.")
            if operation=="autoresponder_edit":
                if a.protocol.adapter!="directadmin":
                    raise ResourceRefused("This supplier requires explicit remove and create.")
                a.protocol.autoresponder_content(local)
    elif forwarder:
        if target not in [x["address"] for x in a.protocol.mailboxes()]:
            raise ResourceRefused("Forwarding mailbox not independently identified.")
        rows=[x for x in a.protocol.forwarders() if x["address"]==target]
        if operation=="forwarder_create" and rows:
            raise ResourceRefused("Remove the existing forwarding route before creating another.")
        if operation=="forwarder_delete" and (len(rows)!=1 or not rows[0]["managed"] or rows[0]["destination"]!=destination):
            raise ResourceRefused("Forwarding route cannot be independently identified.")
    elif mailbox:
        rows=a.protocol.mailboxes()
        matches=[x for x in rows if x["address"]==target]
        if len(matches)!=1:
            raise ResourceRefused("Mailbox not independently identified.")
        if operation=="mailbox_quota":
            count,limit,disk=a.protocol.mailbox_capacity()
            if count<len(rows) or (disk is not None and quota>disk):
                raise ResourceRefused("Storage quota exceeds hosting limit.")
            if matches[0]["quota_mb"]==quota and not matches[0]["unlimited"]:
                return {"state":"confirmed","address":target,"unchanged":True}
    elif operation in ("database_user_create","database_user_delete","database_grants","database_user_password"):
        if database_name is not None:
            a.protocol._db_identity(database_name)
            if database_name not in a.protocol.databases():
                raise ResourceRefused("Database not independently identified.")
        if operation=="database_grants":
            if database_name is None or not isinstance(profile,str) or profile not in DB_PROFILES:
                raise ResourceRefused("Provide an owned database and supported privilege profile.")
            if target not in a.protocol.all_database_users():
                raise ResourceRefused("Database user not independently identified.")
            if a.protocol.adapter=="directadmin" and target not in a.protocol.database_users(database_name):
                raise ResourceRefused("Create a DirectAdmin database user on this database first.")
        else:
            if (database_name is None)==(a.protocol.adapter=="directadmin"):
                raise ResourceRefused("Unexpected database user scope.")
            if operation=="database_user_create":
                strong_password(password)
                if a.protocol.user_exists(target):
                    raise ResourceRefused("Database user already exists.")
                # Bound user count independent of provider package database limit.
                if len(a.protocol.all_database_users())>=100:
                    raise ResourceRefused("Database user limit reached.")
            else:
                members=a.protocol.database_users(database_name) if database_name else a.protocol.all_database_users()
                if target not in members:
                    raise ResourceRefused("Database user not independently identified.")
                if operation=="database_user_password":
                    strong_password(password)
                    if a.protocol.verify_database_user_password(target,password,database_name):
                        return {"state":"confirmed","address":target,"unchanged":True}
    elif database:
        rows=a.protocol.databases()
        if operation=="database_create":
            count,limit=a.protocol.database_capacity()
            if target in rows or count<len(rows) or (limit is not None and count>=limit):
                raise ResourceRefused("Database exists or capacity unavailable.")
            if a.protocol.adapter=="directadmin":
                database_suffix(initial_user)
                strong_password(password)
                if a.protocol.user_exists(a.protocol.database_name(initial_user)):
                    raise ResourceRefused("Initial database user already exists.")
            elif initial_user is not None or password is not None:
                raise ResourceRefused("Create cPanel database users separately.")
        elif target not in rows:
            raise ResourceRefused("Database not independently identified.")
    else:
        rows=a.protocol.subdomains()
        if operation=="subdomain_create":
            count,limit=a.protocol.subdomain_capacity()
            if target in rows or count<len(rows) or (limit is not None and count>=limit):
                raise ResourceRefused("Subdomain exists or capacity unavailable.")
        elif target not in rows:
            raise ResourceRefused("Subdomain not independently identified.")
    event=str(uuid.uuid4())
    pending={"id":event,"operation":operation,"address":target,"binding":a.digest,
             "state":"dispatched_uncertain","created_at":timezone.now().isoformat()}
    if operation in ("autoresponder_create","autoresponder_edit"):
        pending["password_receipt"]=_password_receipt(event,_reply_digest(reply_subject,reply_body))
    if forwarder:
        pending["destination"]=destination
    if operation=="database_create" and initial_user is not None:
        pending["initial_user"]=a.protocol.database_name(initial_user)
    if operation in ("database_user_create","database_user_delete","database_grants","database_user_password"):
        pending["database"]=database_name
        if operation=="database_user_password":
            pending["password_receipt"]=_password_receipt(event,password)
        if operation=="database_grants":
            pending["profile"]=profile
    if hosting:
        pending["password_receipt"]=_password_receipt(event,password)
    if operation=="mailbox_quota":
        pending["quota_mb"]=quota
    elif operation=="mailbox_password":
        pending["quota_mb"]=matches[0]["quota_mb"]
        pending["unlimited"]=matches[0]["unlimited"]
        pending["password_receipt"]=_password_receipt(event,password)
        if not pending["unlimited"] and (type(pending["quota_mb"]) is not int or not 1<=pending["quota_mb"]<=1000000):
            raise ResourceRefused("Mailbox quota cannot be safely preserved.")
    with transaction.atomic():
        service,a=_lock(a,operation)
        if service.metadata.get(FENCE)!=previous:
            raise ResourceRefused("Hosting resource state changed.")
        service.metadata={**service.metadata,FENCE:pending}
        service.save(update_fields=["metadata"])
        _record(service,operation,"reserved",event,actor_id=subject)
    try:
        a=_current(a,operation)
        if hosting:
            a.protocol.reset_hosting_password(password)
        elif autoresponder:
            if operation=="autoresponder_delete":
                a.protocol.delete_autoresponder(local)
            else:
                a.protocol.save_autoresponder(local,reply_subject,reply_body,edit=operation=="autoresponder_edit")
        elif operation=="forwarder_create":
            a.protocol.create_forwarder(local,destination)
        elif operation=="forwarder_delete":
            a.protocol.delete_forwarder(local,destination)
        elif operation=="mailbox_delete":
            a.protocol.delete_mailbox(local)
        elif operation=="mailbox_quota":
            a.protocol.change_mailbox_quota(local,quota)
        elif operation=="mailbox_password":
            a.protocol.change_mailbox_password(local,password,pending["quota_mb"])
        elif operation=="database_create":
            a.protocol.create_database(local,initial_user=initial_user,password=password)
        elif operation=="database_delete":
            a.protocol.delete_database(target)
        elif operation=="database_user_create":
            a.protocol.create_database_user(local,password,database_name)
        elif operation=="database_user_delete":
            a.protocol.delete_database_user(target,database_name)
        elif operation=="database_user_password":
            a.protocol.dispatch_database_user_password(target,password,database_name)
        elif operation=="database_grants":
            a.protocol.set_database_grants(database_name,target,profile)
        elif operation=="subdomain_create":
            a.protocol.create_subdomain(local)
        else:
            a.protocol.delete_subdomain(local)
        if not _observed(a.protocol,pending,password):
            raise ResourceRefused("Supplier outcome not confirmed.")
        _finish(a,event,"confirmed",operation)
        return {"state":"confirmed","operation_id":event,"address":target,**({"password_status":"unverified"} if operation=="database_user_create" or (operation=="database_create" and initial_user is not None) else {})}
    except (ResourceRefused,ReadbackRejected,SupplierEgressDenied,VaultUnavailable,DatabaseError,
            Service.DoesNotExist,IntegrationConnection.DoesNotExist,Provider.DoesNotExist):
        return {"state":"pending_verification","operation_id":event}


@sensitive_variables("password")
def reconcile_resource(subject,service_id,*,password=None):
    _budget(subject,write=True)
    service=Service.objects.filter(pk=service_id,client_id=subject).first()
    pending=service.metadata.get(FENCE,{}) if service else {}
    operation=pending.get("operation")
    if operation not in OBSERVABLE_MUTATIONS or pending.get("state")!="dispatched_uncertain":
        raise ResourceRefused("No eligible pending operation.")
    a=authority(subject,service_id,operation)
    if operation not in ("mailbox_password","hosting_password","database_user_password") and password is not None:
        raise ResourceRefused("Unexpected verification fields.")
    if a.digest!=pending.get("binding") or a.service.metadata.get(FENCE)!=pending:
        raise ResourceRefused("Pending resource authority changed.")
    if operation in ("mailbox_password","hosting_password","database_user_password") and password is None:
        return {"state":"pending_verification","operation_id":pending["id"],"password_status":"verification_required"}
    created=parse_datetime(pending.get("created_at",""))
    if not created or timezone.is_naive(created) or timezone.now()-created<timedelta(minutes=2):
        return {"state":"pending_verification","operation_id":pending["id"]}
    verify_existing_account(a.service,a.provider)
    a=_current(a,operation)
    if not _observed(a.protocol,pending,password):
        return {"state":"pending_verification","operation_id":pending["id"]}
    _finish(a,pending["id"],"confirmed",operation)
    return {"state":"confirmed","operation_id":pending["id"],"address":pending["address"],**({"password_status":"unverified"} if operation=="database_user_create" or (operation=="database_create" and pending.get("initial_user")) else {})}

def mailbox_connection_settings(subject,service_id,local):
    mailbox_name(local)
    _budget(subject)
    a=authority(subject,service_id,"mail_client_settings")
    if a.protocol.adapter!="cpanel-whm":
        raise ResourceRefused("Supplier client settings unavailable.")
    verify_existing_account(a.service,a.provider)
    a=_current(a,"mail_client_settings")
    if local+"@"+a.protocol.domain not in [x["address"] for x in a.protocol.mailboxes()]:
        raise ResourceRefused("Mailbox not independently identified.")
    result=a.protocol.mail_client_settings(local)
    _current(a,"mail_client_settings")
    return result


@sensitive_variables("url","key","response")
def launch_webmail(subject,service_id,local):
    from .native_panel import _session_request,parse_session,NativePanelRefused
    mailbox_name(local)
    _budget(subject,write=True)
    a=authority(subject,service_id,"webmail_launch")
    if a.protocol.adapter!="cpanel-whm":
        raise ResourceRefused("Supplier webmail unavailable.")
    verify_existing_account(a.service,a.provider)
    a=_current(a,"webmail_launch")
    address=local+"@"+a.protocol.domain
    if address not in [x["address"] for x in a.protocol.mailboxes()] or local==a.protocol.account.lower():
        raise ResourceRefused("Mailbox not independently identified.")
    a=_current(a,"webmail_launch")
    row,key,_=load_hosting_connection(a.provider)
    if row.pk!=a.row.pk or row.current_version!=a.row.current_version:
        raise ResourceRefused("Hosting authority changed.")
    try:
        response=_session_request(row,a.provider,a.protocol.account,key,webmail_address=address)
        url=parse_session(response,a.protocol.origin,a.protocol.adapter,address,service="webmaild")
    except NativePanelRefused:
        raise ResourceRefused("Supplier webmail unavailable.") from None
    _current(a,"webmail_launch")
    return {"url":url}
