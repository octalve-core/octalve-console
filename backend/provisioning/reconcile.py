"""Paid-hosting provider reconciliation: no creation request, never trust queue success.

A pre-existing, *authoritatively verified* provider account may be attached to
a pending, fully paid hosting service, then and only then activated and granted
fresh OPanel evidence in one DB transaction. This is NOT a provider account
creation worker. The create-account adapter remains disabled without a verified
test server and independent reconciliation/idempotency contract.
"""
from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from billing.models import Invoice
from orders.models import Order, OrderItem
from payments.models import Transaction
from providers.models import Provider
from services.models import Service
from opanel_bridge.models import VerifiedHostingBinding
from opanel_bridge.policy import account_digest
from opanel_bridge.readback import verify_existing_account, ReadbackRejected, unique_account
from provisioning.authority import require_verified_settlement, SettlementNotVerified
from provisioning.fulfillment import _validate_item, FulfillmentRefused
from provisioning.models import ProvisioningTask


class ReconciliationRefused(ValueError):
    pass


def reconcile_verified_hosting(task_id, *, getter=None, apply=False):
    """Read-only vendor GET by default; apply writes ONLY after exact readback.

    Backend-only service: there is deliberately no HTTP view and no timer.
    Operator/worker invocation is feature-gated; no external provider account
    creation and no support for failed/expired/ambiguous payment records.
    """
    if not getattr(settings, "CLOUD_PROVISIONING_WORKER_ENABLED", False):
        raise ReconciliationRefused("Hosting reconciliation worker is disabled.")
    if not getattr(settings, "OPANEL_READBACK_ENABLED", False):
        raise ReconciliationRefused("Independent hosting verification is disabled.")
    try:
        task = ProvisioningTask.objects.select_related("service", "provider").get(pk=task_id)
    except (ProvisioningTask.DoesNotExist, ValueError, TypeError):
        raise ReconciliationRefused("Unknown hosting task.") from None
    account = task.payload.get("expected_account") if isinstance(task.payload, dict) else None
    if (
        task.action != "provision" or task.status != "queued"
        or not task.lock_key or task.lock_key != f"paid-hosting:order-item:{task.order_item_id}:v1"
        or not task.order_id or not task.order_item_id or not task.provider_id
        or task.service.status != "pending"
        or task.service.provider_identifier or task.service.activated_at
        or task.service.provider_id != task.provider_id
        or not account or len(account) > 16
        or task.payload.get("order_item_id") != task.order_item_id
    ):
        raise ReconciliationRefused("Task is not a pending, uniquely staged hosting account.")
    try:
        result = verify_existing_account(task.service, task.provider,
                                         getter=getter, pending_account=account)
    except ReadbackRejected as exc:
        raise ReconciliationRefused("Provider has not independently confirmed the hosting account.") from exc
    if not apply:
        return result

    with transaction.atomic():
        # Re-evaluate ALL financial and technical conditions after HTTPS I/O.
        fresh = ProvisioningTask.objects.select_for_update().get(pk=task.pk)
        order = Order.objects.select_for_update().get(pk=task.order_id)
        invoice = Invoice.objects.select_for_update().get(pk=fresh.payload["invoice_id"])
        service = Service.objects.select_for_update().get(pk=fresh.service_id)
        item = OrderItem.objects.select_for_update().get(pk=fresh.order_item_id)
        provider = Provider.objects.select_for_update().get(pk=fresh.provider_id)
        payment = Transaction.objects.select_for_update().filter(pk=fresh.metadata.get(
            "settlement_transaction_id")).select_related("gateway").first()
        if not payment:
            raise ReconciliationRefused("No recorded verified settlement.")
        try:
            require_verified_settlement(invoice, payment)
            approved_provider, package, domain = _validate_item(item, invoice)
        except (SettlementNotVerified, FulfillmentRefused) as exc:
            raise ReconciliationRefused(str(exc)) from None
        if (
            fresh.status != "queued" or fresh.action != "provision"
            or fresh.lock_key != task.lock_key
            or fresh.payload != task.payload or fresh.metadata != task.metadata
            or order.status != "paid" or order.client_id != service.client_id
            or invoice.order_id != order.pk or item.order_id != order.pk
            or service.order_item_id != item.pk or service.invoice_id != invoice.pk
            or payment.reference != fresh.payload.get("settlement_reference")
            or service.provider_id != provider.pk or approved_provider.pk != provider.pk
            or service.status != "pending" or service.activated_at is not None
            or service.provider_identifier
            or not unique_account(service, account)
            or service.domain_name != domain or service.provider_package_id != package
            or provider.adapter_type != task.provider.adapter_type
            or provider.base_url != task.provider.base_url
            or provider.username != task.provider.username
            or provider.config != task.provider.config
            or provider.encrypted_api_key != task.provider.encrypted_api_key
            or provider.status != "active" or provider.health_status != "healthy"
            or provider.test_mode
            or VerifiedHostingBinding.objects.filter(service=service).exists()
        ):
            raise ReconciliationRefused("Hosting, ownership or vendor authority changed during readback.")

        # Timestamp of genuine vendor check is also activation time. The
        # customer receives the purchased period starting NOW, not queue time.
        service.status = "active"
        service.provider_identifier = account
        service.activated_at = result.checked_at
        service.next_due_date = result.checked_at + relativedelta(months=item.months)
        service.save(update_fields=[
            "status", "provider_identifier", "activated_at", "next_due_date", "updated_at"])
        VerifiedHostingBinding.objects.create(
            service=service, provider_id_snapshot=provider.pk,
            account_digest=account_digest(service),
            confirmation_source="provider_api_readback",
            confirmed_at=result.checked_at,
        )
        fresh.status = "completed"
        fresh.completed_at = timezone.now()
        fresh.result_data = {
            "verification": "direct_provider_api_readback", "hosting_account": account,
            "verified_at": result.checked_at.isoformat(),
        }
        fresh.save(update_fields=["status", "completed_at", "result_data", "updated_at"])
        # For multi-item orders, only close the order after EVERY item is
        # activated by its own independent account verification.
        if not Service.objects.filter(order=order).exclude(status="active").exists():
            if not OrderItem.objects.filter(order=order).exclude(
                pk__in=Service.objects.filter(order=order).values_list("order_item_id", flat=True)
            ).exists():
                order.status = "provisioned"
                order.provisioned_at = timezone.now()
                order.save(update_fields=["status", "provisioned_at", "updated_at"])
        return result
