"""Read-only plan for audited WHM/DirectAdmin account creation.

NO remote POST, password generation, account existence speculation or task
status mutation. Such operations require an approved credential broker, egress
controls, attempt ledger and exact pre/post-creation readback. This contract
ensures the paid item determines the only allowed username/domain/package.
"""
import re
from dataclasses import dataclass

from billing.models import Invoice
from orders.models import OrderItem
from payments.models import Transaction
from provisioning.authority import require_verified_settlement, SettlementNotVerified
from provisioning.fulfillment import _validate_item, planned_hosting_username, FulfillmentRefused
from provisioning.models import ProvisioningTask
from services.models import Service

PACKAGE = re.compile(r"^[A-Za-z0-9_.-]{1,80}$")
OWNER = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{1,31}$")


class CreationPlanRefused(ValueError):
    pass


@dataclass(frozen=True)
class AccountCreationPlan:
    task_id: int
    service_id: int
    provider_id: int
    adapter_type: str
    username: str
    domain: str
    package: str
    reseller_owner: str
    email: str
    needs_authorized_egress: bool = True
    remote_account_creation_enabled: bool = False


def plan_account_creation(task_id, *, allow_reserved=False):
    """Pure database preflight; always requires approved financial provenance."""
    try:
        task = ProvisioningTask.objects.select_related(
            "service", "provider", "order", "order_item").get(pk=task_id)
    except (ProvisioningTask.DoesNotExist, ValueError, TypeError):
        raise CreationPlanRefused("Hosting task not found.") from None
    if (task.action != "provision" or not (
            task.status == "queued" or (
                allow_reserved and task.status == "pending_confirmation"
                and isinstance(task.metadata, dict)
                and isinstance(task.metadata.get("remote_create"), dict)
                and task.metadata["remote_create"].get("state") == "reserved_no_network"))
            
            or not task.order_id or not task.order_item_id
            or not task.provider_id or not task.service_id
            or task.lock_key != f"paid-hosting:order-item:{task.order_item_id}:v1"
            or task.metadata.get("authority") != "verified_paid_order"
            or task.metadata.get("requires_vendor_confirmation") is not True
            or not isinstance(task.payload, dict)):
        raise CreationPlanRefused("Hosting task has no approved provisioning authority.")
    service = task.service
    order = task.order
    item = task.order_item
    provider = task.provider
    invoice = Invoice.objects.filter(pk=task.payload.get("invoice_id")).first()
    payment = Transaction.objects.select_related("gateway").filter(
        pk=task.metadata.get("settlement_transaction_id")).first()
    if not invoice or not payment:
        raise CreationPlanRefused("Required financial authority missing.")
    try:
        require_verified_settlement(invoice, payment)
        approved, package, domain = _validate_item(item, invoice)
        username = planned_hosting_username(item.pk)
    except (SettlementNotVerified, FulfillmentRefused) as exc:
        raise CreationPlanRefused(str(exc)) from None
    config = provider.config if isinstance(provider.config, dict) else {}
    owner = config.get("hosting_account_owner")
    if (not isinstance(owner, str) or not OWNER.fullmatch(owner)
            or not PACKAGE.fullmatch(package)
            or provider.pk != approved.pk
            or task.provider_id != service.provider_id
            or invoice.order_id != order.pk or item.order_id != order.pk
            or service.order_id != order.pk or service.order_item_id != item.pk
            or service.invoice_id != invoice.pk or service.client_id != order.client_id
            or order.status != "paid"
            or service.status != "pending" or service.activated_at is not None
            or service.provider_identifier
            or service.domain_name != domain or service.provider_package_id != package
            or task.payload.get("expected_account") != username
            or task.payload.get("domain") != domain
            or task.payload.get("provider_package_id") != package
            or task.payload.get("settlement_reference") != payment.reference
            or task.adapter_type != provider.adapter_type):
        raise CreationPlanRefused("Hosting account-creation contract does not match settled order.")
    return AccountCreationPlan(
        task_id=task.pk, service_id=service.pk, provider_id=provider.pk,
        adapter_type=provider.adapter_type,
        username=username, domain=domain, package=package,
        reseller_owner=owner, email=order.client.email,
    )


def execute_account_creation(*_args, **_kwargs):
    """No remote write until single-attempt recovery and audit gates exist."""
    raise CreationPlanRefused(
        "Remote account creation is disabled pending credential, egress and recovery acceptance.")
