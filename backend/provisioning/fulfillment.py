"""Durable, idempotent, NO-PROVIDER-WRITE paid-hosting outbox.

Converts a separately verified, fully settled invoice into one pending hosting
service and one unique provisioning intent PER hosting order item. Does not
create remote accounts, activate services, touch OPanel proof, or call vendor.
Default disabled until the Review settlement lifecycle is qualified.
"""
import re
from decimal import Decimal, InvalidOperation
from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from billing.models import Invoice
from orders.models import Order, OrderItem
from payments.models import Transaction
from providers.models import Provider
from provisioning.authority import require_verified_settlement, SettlementNotVerified
from provisioning.models import ProvisioningTask
from services.models import Service

DOMAIN = re.compile(
    r"^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+"
    r"[a-z][a-z0-9-]{1,62}$"
)


class FulfillmentRefused(ValueError):
    pass


def _validate_item(item, invoice):
    """Check the immutable checkout snapshot; never trust browser payload."""
    if item.item_type != "hosting" or item.quantity != 1 or item.months < 1:
        raise FulfillmentRefused("Only single-unit published shared hosting is supported.")
    domain = (item.domain_name or "").strip().lower().rstrip(".")
    if not DOMAIN.fullmatch(domain):
        raise FulfillmentRefused("No valid customer-owned hosting domain supplied.")
    snap = item.config.get("catalog_offer_snapshot") if isinstance(item.config, dict) else None
    if not isinstance(snap, dict):
        raise FulfillmentRefused("Published supplier snapshot is not available.")
    try:
        provider_id = int(snap["supplier_provider_id"])
        package = str(snap["technical_package_id"])
        price = Decimal(str(snap["price"])) + Decimal(str(snap["setup_fee"]))
        if (provider_id <= 0 or not package or len(package) > 200
                or snap["plan_id"] != item.plan_id
                or snap["currency"] != invoice.currency
                or snap["billing_period"] != item.cycle_key
                or price != item.unit_price or item.subtotal != item.unit_price):
            raise FulfillmentRefused("Published supplier snapshot is inconsistent.")
    except (KeyError, TypeError, ValueError, InvalidOperation):
        raise FulfillmentRefused("Published supplier snapshot is invalid.") from None
    provider = Provider.objects.filter(
        pk=provider_id, status="active", health_status="healthy",
        test_mode=False, adapter_type__in=("DirectAdminAdapter", "CpanelAdapter"),
    ).first()
    if not provider:
        raise FulfillmentRefused("Approved hosting supplier is unavailable.")
    return provider, package, domain


def planned_hosting_username(order_item_id):
    """Reversible, collision-free 8-character username for DA and WHM.

    DirectAdmin's legacy create-user API accepts only 4–8 alphanumeric
    characters. Encoding the stable DB primary key (not truncating/modulo)
    in six base36 digits guarantees no collisions within the supported range.
    """
    if type(order_item_id) is not int or not 1 <= order_item_id < 36 ** 6:
        raise FulfillmentRefused("Order ID exceeds the common DA/WHM username range.")
    alphabet = "0123456789abcdefghijklmnopqrstuvwxyz"
    number = order_item_id
    digits = ""
    for _ in range(6):
        digits = alphabet[number % 36] + digits
        number //= 36
    return "oc" + digits


def stage_paid_order(order_id):
    """Internal server-only staging under order locks; reruns are idempotent."""
    if not getattr(settings, "CLOUD_FULFILLMENT_STAGING_ENABLED", False):
        raise FulfillmentRefused("Hosting fulfillment staging is disabled.")
    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(pk=order_id)
        except (Order.DoesNotExist, TypeError, ValueError):
            raise FulfillmentRefused("Order not found.") from None
        invoice = Invoice.objects.select_for_update().filter(order=order).first()
        if not invoice:
            raise FulfillmentRefused("Order is missing invoice.")
        if Invoice.objects.filter(order=order).exclude(pk=invoice.pk).exists():
            raise FulfillmentRefused("Multiple invoices require a manual reconciliation.")
        if invoice.client_id != order.client_id or order.status != "paid":
            raise FulfillmentRefused("Order ownership or settlement status is invalid.")
        payments = Transaction.objects.filter(invoice=invoice, status="successful")
        if payments.count() != 1:
            raise FulfillmentRefused("Exactly one verified transaction is required.")
        payment = payments.select_related("gateway").first()
        try:
            require_verified_settlement(invoice, payment)
        except SettlementNotVerified as exc:
            raise FulfillmentRefused(str(exc)) from None
        items = list(OrderItem.objects.select_for_update().filter(order=order).order_by("pk"))
        if not items:
            raise FulfillmentRefused("Paid order contains no items.")
        results = []
        for item in items:
            provider, package, domain = _validate_item(item, invoice)
            prior = list(Service.objects.select_for_update().filter(order_item=item))
            if len(prior) > 1:
                raise FulfillmentRefused("Multiple hosting services already reference one item.")
            service = prior[0] if prior else None
            if service:
                if (service.client_id != order.client_id or service.order_id != order.pk
                        or service.invoice_id != invoice.pk or service.provider_id != provider.pk
                        or service.status not in ("pending", "provisioning")
                        or service.domain_name != domain
                        or service.provider_package_id != package):
                    raise FulfillmentRefused("Existing service conflicts with the published order.")
            else:
                service = Service.objects.create(
                    client_id=order.client_id, order=order, order_item=item,
                    invoice=invoice, product_id=item.product_id, plan_id=item.plan_id,
                    provider_id=provider.pk, provider_package_id=package,
                    provider_identifier=None, service_type="hosting",
                    status="pending", label=item.description[:255],
                    domain_name=domain, billing_cycle=item.cycle_key,
                    amount=item.unit_price, currency=invoice.currency,
                    next_due_date=timezone.now() + relativedelta(months=item.months),
                    activated_at=None,
                )
            # Deterministic provider username for the one paid order item.
            # The actual account must still be created/proven on an authorised
            # hosting server; this value is NOT evidence of an account.
            planned_account = planned_hosting_username(item.pk)
            key = f"paid-hosting:order-item:{item.pk}:v1"
            task = ProvisioningTask.objects.select_for_update().filter(lock_key=key).first()
            if task:
                if (task.order_item_id != item.pk or task.order_id != order.pk
                        or task.service_id != service.pk or task.provider_id != provider.pk
                        or task.action != "provision"
                        or task.payload.get("expected_account") != planned_account
                        or task.metadata.get("settlement_transaction_id") != payment.pk):
                    raise FulfillmentRefused("Conflicting fulfillment idempotency key.")
            else:
                task = ProvisioningTask.objects.create(
                    service=service, order=order, order_item=item,
                    provider=provider, adapter_type=provider.adapter_type,
                    action="provision", status="queued", lock_key=key,
                    payload={"domain": domain, "provider_package_id": package,
                             "order_item_id": item.pk, "invoice_id": invoice.pk,
                             "settlement_reference": payment.reference,
                             "expected_account": planned_account},
                    metadata={"authority": "verified_paid_order",
                              "settlement_transaction_id": payment.pk,
                              "requires_vendor_confirmation": True},
                )
            results.append((service, task))
        return results
