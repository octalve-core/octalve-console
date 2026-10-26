"""Durable one-time *reservation* for future remote hosting-account creation.

No vendor endpoint is invoked here. The reservation is a local transactional
recovery fence, NOT proof a POST was sent or that a remote account exists. Its
stable identifier and expected account survive worker crashes and operator
restarts. A future approved worker must record a dispatched/uncertain state
BEFORE remote I/O, must never generate another attempt on timeout, and must
use exact vendor read-back before granting hosting or OPanel authority.
"""
from dataclasses import dataclass
from hashlib import sha256
import json
import secrets

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from provisioning.account_creation_plan import plan_account_creation, CreationPlanRefused
from provisioning.models import ProvisioningTask, ProvisioningLog
from services.models import Service
from providers.models import Provider


class CreateReservationRefused(ValueError):
    pass


@dataclass(frozen=True)
class CreateReservation:
    task_id: int
    service_id: int
    provider_id: int
    attempt_id: str
    username: str
    state: str
    created: bool
    remote_request_sent: bool = False


def _identity_digest(plan):
    """Compare only relevant immutable, non-secret task/business coordinates."""
    canonical = {
        "task_id": plan.task_id,
        "service_id": plan.service_id,
        "provider_id": plan.provider_id,
        "adapter_type": plan.adapter_type,
        "username": plan.username,
        "domain": plan.domain,
        "package": plan.package,
        "reseller_owner": plan.reseller_owner,
        "email": plan.email,
    }
    return sha256(json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def reserve_account_create(task_id, *, apply=False):
    """Prepare EXACTLY ONE scoped attempt; dry-run leaves no state changes.

    Runs only from trusted server/management context. No POST is issued, and
    there is no user HTTP route. A repeat returns the same attempt only if all
    financial/hosting/provider coordinates still match; otherwise it fails.
    """
    if not getattr(settings, "CLOUD_CREATE_ATTEMPT_RESERVATION_ENABLED", False):
        raise CreateReservationRefused("Remote-create reservation is disabled.")
    if not getattr(settings, "CLOUD_PROVISIONING_WORKER_ENABLED", False):
        raise CreateReservationRefused("Provisioning worker is not approved.")
    if type(task_id) is not int or task_id < 1:
        raise CreateReservationRefused("Invalid hosting task ID.")
    with transaction.atomic():
        try:
            task = ProvisioningTask.objects.select_for_update().get(pk=task_id)
        except ProvisioningTask.DoesNotExist:
            raise CreateReservationRefused("Hosting task not found.") from None
        if task.service_id is None or task.provider_id is None:
            raise CreateReservationRefused("Hosting task has no provider or service.")
        Service.objects.select_for_update().get(pk=task.service_id)
        Provider.objects.select_for_update().get(pk=task.provider_id)
        prior = (task.metadata or {}).get("remote_create") if isinstance(task.metadata, dict) else None
        if prior is not None:
            if (not isinstance(prior, dict) or prior.get("state") != "reserved_no_network"
                    or type(prior.get("attempt_id")) is not str
                    or len(prior["attempt_id"]) != 32
                    or task.status != "pending_confirmation"):
                raise CreateReservationRefused("Attempt outcome requires manual reconciliation.")
            try:
                plan = plan_account_creation(task.pk, allow_reserved=True)
            except CreationPlanRefused as exc:
                raise CreateReservationRefused(str(exc)) from None
            if (prior.get("digest") != _identity_digest(plan)
                    or prior.get("username") != plan.username
                    or prior.get("provider_id") != plan.provider_id):
                raise CreateReservationRefused("Hosting plan changed after reservation.")
            return CreateReservation(task.pk, task.service_id, task.provider_id,
                                     prior["attempt_id"], plan.username,
                                     "reserved_no_network", False)
        if task.status != "queued" or task.attempt_count != 0:
            raise CreateReservationRefused("Hosting task is not new and unattempted.")
        try:
            plan = plan_account_creation(task.pk)
        except CreationPlanRefused as exc:
            raise CreateReservationRefused(str(exc)) from None
        if not apply:
            return CreateReservation(task.pk, task.service_id, task.provider_id, "",
                                     plan.username, "dry_run", False)
        identifier = secrets.token_hex(16)
        entry = {"attempt_id": identifier, "state": "reserved_no_network",
                 "username": plan.username, "provider_id": plan.provider_id,
                 "digest": _identity_digest(plan), "created_at": timezone.now().isoformat()}
        task.metadata = {**task.metadata, "remote_create": entry}
        task.status = "pending_confirmation"
        task.started_at = timezone.now()
        task.attempt_count = 1
        task.executed_by = "hosting-creation-reservation"
        task.save(update_fields=["metadata", "status", "started_at",
                                 "attempt_count", "executed_by", "updated_at"])
        ProvisioningLog.objects.create(
            task=task, step="remote_create_reserved", log_level="info",
            message="One provider account creation attempt reserved; no network request issued.",
            request_data={}, response_data={},
            metadata={"attempt_id": identifier, "network_request_sent": False},
        )
        return CreateReservation(task.pk, task.service_id, task.provider_id,
                                 identifier, plan.username,
                                 "reserved_no_network", True)


def execute_remote_create(*_args, **_kwargs):
    """Deliberately no WAN write transport before vendor and vault approval."""
    raise CreateReservationRefused(
        "Real provider account creation is disabled; reconcile a confirmed account.")
