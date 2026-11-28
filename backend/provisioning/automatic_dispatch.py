"""Single-attempt automatic hosting dispatch on existing durable task ledger."""
from datetime import timedelta
from hashlib import sha256
from django.conf import settings
from django.db import connection,transaction,DatabaseError
from django.utils import timezone
from django.db.models import Q
from providers.hosting_runtime import release_enabled,load_hosting_connection,POLICY
from providers.connection_vault import VaultUnavailable
from providers.connection_models import IntegrationConnection
from providers.pinned_egress import SupplierEgressDenied
from providers.models import Provider,ProviderPackage
from provisioning.models import ProvisioningTask,ProvisioningLog
from provisioning.create_attempt import reserve_account_create,_identity_digest,CreateReservationRefused
from provisioning.account_creation_plan import plan_account_creation,CreationPlanRefused
from provisioning.hosting_vendor_protocol import PinnedHostingProtocol,VendorProtocolRefused
from provisioning.domain_authority import verified_domain,KEY
from provisioning.reconcile import reconcile_verified_hosting,ReconciliationRefused
from services.models import Service


def enabled():
    return (release_enabled() and getattr(settings,"CLOUD_PROVISIONING_WORKER_ENABLED",False)
        and getattr(settings,"CLOUD_CREATE_ATTEMPT_RESERVATION_ENABLED",False)
        and getattr(settings,"OPANEL_READBACK_ENABLED",False)
        and getattr(settings,"CLOUD_SETTLEMENT_COMMIT_ENABLED",False))


def _protocol(task,plan):
    row,key,policy=load_hosting_connection(task.provider)
    if not ProviderPackage.objects.filter(provider=task.provider,provider_package_id=plan.package,
            is_active=True,raw_data__connection=str(row.pk),
            raw_data__credential_version=row.current_version,raw_data__available=True).exists():
        raise CreateReservationRefused("Purchased supplier package requires current approval.")
    protocol=PinnedHostingProtocol(plan,row.public_settings["server_url"],task.provider.username,key,
        bound_origin=(row.public_settings["server_url"],row.public_settings["server_ip"]))
    return protocol,policy


@transaction.atomic
def _mark_dispatched(task_id,plan,snapshot):
    # Global domain fence across suppliers and orders on PostgreSQL.
    if connection.vendor!="postgresql":
        raise CreateReservationRefused("Durable production domain fence unavailable.")
    number=int.from_bytes(sha256(plan.domain.encode()).digest()[:8],"big",signed=True)
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(%s)",[number])
    fresh=ProvisioningTask.objects.select_for_update().get(pk=task_id)
    from providers.connection_models import IntegrationConnection
    connection_id=fresh.provider.config.get("hosting_vault_connection_id")
    IntegrationConnection.objects.select_for_update().get(pk=connection_id)
    provider=Provider.objects.select_for_update().get(pk=fresh.provider_id)
    fresh.provider=provider
    now_plan=plan_account_creation(task_id,allow_reserved=True)
    if (now_plan!=plan or fresh.metadata!=snapshot or fresh.status!="pending_confirmation"
            or fresh.metadata.get("remote_create",{}).get("state")!="reserved_no_network"
            or fresh.metadata["remote_create"].get("digest")!=_identity_digest(plan)):
        raise CreateReservationRefused("Reservation changed before dispatch.")
    if Service.objects.filter(domain_name__iexact=plan.domain,status__in=("active","suspended","provisioning")).exclude(pk=fresh.service_id).exists():
        raise CreateReservationRefused("Domain already belongs to another hosting service.")
    if ProvisioningTask.objects.filter(action="provision",service__domain_name__iexact=plan.domain,
            metadata__remote_create__state="dispatched_uncertain").exclude(pk=task_id).exists():
        raise CreateReservationRefused("Another hosting attempt already controls this domain.")
    protocol,policy=_protocol(fresh,plan)
    entry={**fresh.metadata["remote_create"],"state":"dispatched_uncertain",
           "dispatched_at":timezone.now().isoformat(),"supplier_policy":provider.config[POLICY]}
    fresh.metadata={**fresh.metadata,"remote_create":entry}
    fresh.save(update_fields=["metadata","updated_at"])
    ProvisioningLog.objects.create(task=fresh,step="remote_create_dispatch_fenced",log_level="info",
        message="Single create dispatch reserved; outcome remains uncertain until readback.",
        request_data={},response_data={},metadata={"attempt_id":entry["attempt_id"]})
    return protocol,policy


def advance(task_id):
    if not enabled():
        return "disabled"
    try:
        task=ProvisioningTask.objects.select_related("provider","service").get(pk=task_id,
            action="provision",metadata__authority="verified_paid_order")
        if task.status=="completed":
            return "completed"
        if task.status not in ("queued","pending_confirmation") or not task.provider.config.get("hosting_vault_connection_id"):
            return "held"
        entry=task.metadata.get("remote_create",{})
        if entry.get("state")=="dispatched_uncertain":
            # After any possible dispatch, ONLY readback; never resubmit.
            reconcile_verified_hosting(task.pk,apply=True)
            return "completed"
        plan=plan_account_creation(task.pk,allow_reserved=True)
        if not verified_domain(task):
            return "awaiting_domain_proof"
        protocol,_=_protocol(task,plan)
        protocol.absent()
        reserve_account_create(task.pk,apply=True)
        task.refresh_from_db()
        if task.metadata.get("remote_create",{}).get("state")!="reserved_no_network":
            return "held"
        # Compare the exact challenge used for the successful DNS lookup.
        if not verified_domain(task):
            return "awaiting_domain_proof"
        protocol,policy=_mark_dispatched(task.pk,plan,task.metadata)
        try:
            protocol.create(dispatch_authorized=True,shared_ip=policy["shared_ip"])
        except (VendorProtocolRefused,SupplierEgressDenied):
            pass
        reconcile_verified_hosting(task.pk,apply=True)
        return "completed"
    except (ProvisioningTask.DoesNotExist,Provider.DoesNotExist,CreateReservationRefused,CreationPlanRefused,
            VendorProtocolRefused,SupplierEgressDenied,ReconciliationRefused,VaultUnavailable,DatabaseError,IntegrationConnection.DoesNotExist):
        return "held"


def run_due_dispatch(limit=2):
    result={"enabled":bool(enabled()),"completed":0,"held":0}
    if not enabled():
        return result
    rows=ProvisioningTask.objects.filter(action="provision",status__in=["queued","pending_confirmation"],
        metadata__authority="verified_paid_order",metadata__has_key=KEY,scheduled_at__lte=timezone.now(),
        provider__config__has_key="hosting_vault_connection_id").order_by("scheduled_at","pk")
    for pk in list(rows.values_list("pk",flat=True)[:min(max(limit,1),2)]):
        state=advance(pk)
        if state=="completed":
            result["completed"]+=1
        else:
            ProvisioningTask.objects.filter(pk=pk,status__in=["queued","pending_confirmation"]).update(
                scheduled_at=timezone.now()+timedelta(minutes=15))
            result["held"]+=1
    return result
