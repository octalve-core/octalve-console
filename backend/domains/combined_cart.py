"""Combined Test Mode orders. Each domain has its own submission reservation."""
from decimal import Decimal
from uuid import UUID

from django.core import signing
from django.db import transaction
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from billing.contact import billing_contact_snapshot
from billing.models import Invoice, InvoiceItem
from orders.models import Order, OrderItem
from orders.serializers import CreateOrderSerializer
from payments.domain_pilot_scope import (
    CART, PILOT, pilot_gateway_allowed, selected_domain_test_account_allowed, selected_domain_test_allowed,
)
from payments.hosted_checkout import CheckoutRefused, reserve_hosted_checkout
from payments.models import PaymentIntent, WebhookEvent
from providers.cloudflare_int01 import CloudflareINT01Denied
from providers.connection_models import IntegrationCredentialVersion
from providers.connection_vault import VaultUnavailable

from .pilot import (
    DomainPurchaseThrottle, _selected_rate, inspect_payment, pilot_readiness,
    quote_domain, registrar, registrant_contact,
)

SALT = "octalve.combined-domain-test-cart.v1"


def selections(user, data):
    domains = data.get("domains")
    services = data.get("services", [])
    if (not isinstance(domains, list) or not 1 <= len(domains) <= 5
            or not all(selected_domain_test_allowed(user, name) for name in domains)
            or len(set(domains)) != len(domains)):
        raise ValidationError("Choose up to five distinct eligible domains.")
    if not isinstance(services, list) or len(domains) + len(services) > 20:
        raise ValidationError("The cart can contain up to 20 items.")
    fields = {"plan_id", "offer_revision", "cycle_key", "domain_name", "quantity"}
    if any(not isinstance(item, dict) or set(item) - fields for item in services):
        raise ValidationError("Invalid service details.")
    return sorted(domains), services


def services_for(services):
    if not services:
        return []
    serializer = CreateOrderSerializer()
    items = serializer.fields["items"].run_validation(services)
    items = serializer.validate_items(items)
    if any(item["plan"].currency != "NGN" for item in items):
        raise ValidationError("All items must use NGN.")
    return items


def lines_for(domains, services):
    return [
        {"name": line["domain"], "amount": line["amount"], "kind": "domain"}
        for line in domains
    ] + [
        {"name": item["description"], "amount": str(item["unit_price"] * item["quantity"]),
         "kind": item["item_type"], "domain": item.get("domain_name", "")}
        for item in services
    ]


def basket_total(lines):
    return sum((Decimal(line["amount"]) for line in lines), Decimal("0.00"))


def existing_domain_order(user, names):
    return OrderItem.objects.filter(
        order__client=user, item_type="domain", domain_name__in=names,
    ).filter(Q(order__metadata__has_key=PILOT) | Q(order__metadata__has_key=CART)).exists()


def quote_cart(user, data):
    names, services = selections(user, data)
    if existing_domain_order(user, names):
        raise ValidationError("A domain already has an order. Resume it from your invoices.")
    if pilot_readiness(user.pk):
        raise ValidationError("Domain test checkout is currently unavailable.")
    from .pilot import QUOTE_SALT
    domains = [signing.loads(quote_domain(user.pk, name, selected=True)["quote"], salt=QUOTE_SALT)
               for name in names]
    with transaction.atomic():
        items = services_for(services)
        lines = lines_for(domains, items)
    return {"lines": lines, "total": str(basket_total(lines)), "currency": "NGN",
            "quote": signing.dumps({"client": user.pk, "domains": domains,
                                    "services": services, "lines": lines}, salt=SALT)}


@transaction.atomic
def accept_cart(user, data):
    try:
        key = str(UUID(data["checkout_id"]))
    except (ValueError, TypeError, KeyError, AttributeError):
        raise ValidationError("A checkout reference is required.") from None
    type(user).objects.select_for_update().get(pk=user.pk)
    existing = Order.objects.filter(client=user, metadata__combined_domain_test_cart__checkout_id=key).first()
    if existing:
        return cart_result(existing)
    try:
        snapshot = signing.loads(data.get("quote", ""), salt=SALT, max_age=300)
    except (signing.BadSignature, TypeError):
        raise ValidationError("The cart quote expired. Review the current prices.") from None
    if snapshot["client"] != user.pk:
        raise NotFound()
    domains = snapshot["domains"]
    names, services = selections(user, {"domains": [item["domain"] for item in domains],
                                        "services": snapshot["services"]})
    if existing_domain_order(user, names):
        raise ValidationError("A domain already has an order. Resume it from your invoices.")
    for domain in domains:
        rate = _selected_rate(domain["domain"], lock=True)
        if (domain["amount"] != rate["registration"]["1"]
                or domain["price_revision"] != rate["revision"]
                or domain["live_route"] != rate["route"]):
            raise ValidationError("Domain pricing changed. Review the current prices.")
        registrar(domain)
    items = services_for(services)
    lines = lines_for(domains, items)
    if lines != snapshot["lines"]:
        raise ValidationError("Service pricing changed. Review the current prices.")
    total = basket_total(lines)
    contact = billing_contact_snapshot(user)
    order = Order.objects.create(client=user, source="web", status="pending_payment", currency="NGN",
                                 subtotal=total, total=total, notes="Test order",
                                 metadata={CART: {"checkout_id": key, "domains": names},
                                           "billing_contact": contact})
    for domain in domains:
        OrderItem.objects.create(order=order, item_type="domain", product_id=0, plan_id=0,
                                 billing_cycle_id=0, domain_name=domain["domain"],
                                 description=f'{domain["domain"]} registration', unit_price=Decimal(domain["amount"]),
                                 cycle_key="1yr", months=12,
                                 config={CART: {**domain, "state": "awaiting_payment"}})
    for item in items:
        plan, cycle = item["plan"], item["billing_cycle"]
        OrderItem.objects.create(order=order, item_type=item["item_type"], product_id=plan.product_id,
                                 plan_id=plan.pk, billing_cycle_id=cycle.pk, description=item["description"],
                                 domain_name=item.get("domain_name", ""), unit_price=item["unit_price"],
                                 quantity=item["quantity"], cycle_key=cycle.cycle_key, months=cycle.months)
    invoice = Invoice.create_from_order(order, test_marker=CART)
    return cart_result(order, invoice)


def cart_result(order, invoice=None):
    invoice = invoice or order.invoices.get()
    return {"invoice_id": invoice.pk, "invoice": invoice.invoice_number, "order": order.order_number,
            "total": str(invoice.total), "currency": invoice.currency,
            "payment_verified": invoice.status == "void" and order.status == "needs_review",
            "payment_started": invoice.payment_intents.exists(),
            "domains": [{"id": line.pk, "name": line.domain_name,
                         "state": line.config[CART]["state"],
                         "registered_at": line.config[CART].get("registration", {}).get("registered_at"),
                         "expires_at": line.config[CART].get("registration", {}).get("expires_at")}
                        for line in order.items.filter(item_type="domain")]}


def confirm_payment(order):
    order.refresh_from_db(fields=["status"])
    if order.status == "needs_review":
        return
    intent, proof = inspect_payment(order)
    with transaction.atomic():
        invoice = Invoice.objects.select_for_update().get(pk=intent.invoice_id)
        payment = PaymentIntent.objects.select_for_update().get(pk=intent.pk)
        locked = Order.objects.select_for_update().get(pk=order.pk)
        if locked.status == "needs_review":
            return
        if (not pilot_gateway_allowed(intent.gateway, invoice) or invoice.order_id != locked.pk
                or invoice.status != "unpaid" or invoice.amount_paid != 0
                or locked.status != "pending_payment" or payment.status not in ("pending", "processing")
                or payment.reference != proof.reference or payment.amount != proof.amount
                or payment.currency != proof.currency or payment.gateway_id != intent.gateway_id
                or invoice.total != proof.amount or locked.total != proof.amount or invoice.currency != proof.currency):
            raise ValidationError("The payment changed during verification.")
        locked.metadata[CART]["payment_reference"] = proof.reference
        locked.status = "needs_review"
        locked.save(update_fields=["metadata", "status", "updated_at"])
        payment.status = "completed"
        payment.save(update_fields=["status"])
        invoice.status = "void"
        invoice.save(update_fields=["status", "updated_at"])


def reconcile_line(order, line_id):
    line = order.items.filter(pk=line_id, item_type="domain").first()
    if not line:
        raise NotFound()
    snapshot = line.config[CART]
    if snapshot["state"] in ("registered", "registration_rejected"):
        return
    supplier, _ = registrar(snapshot)
    contact = registrant_contact()
    confirm_payment(order)
    with transaction.atomic():
        locked = order.items.select_for_update().get(pk=line.pk)
        state = locked.config[CART]["state"]
        if state in ("registered", "registration_rejected"):
            return
        submit = state == "awaiting_payment"
        if submit:
            locked.config[CART]["state"] = "registration_uncertain"
            OrderItem.objects.filter(pk=locked.pk).update(config=locked.config)
    try:
        workflow = (supplier.submit_cart_registration(locked, contact) if submit
                    else supplier.pilot_registration_status(line.domain_name))
    except CloudflareINT01Denied:
        return
    state = {"failed": "registration_rejected", "action_required": "registration_action_required"}.get(
        workflow["state"], "registration_pending")
    confirmation = {}
    if workflow["state"] == "succeeded":
        try:
            confirmation = supplier.get_registration(line.domain_name)
        except CloudflareINT01Denied:
            pass
        if confirmation.get("sandbox_status") == "active":
            state = "registered"
    with transaction.atomic():
        locked = order.items.select_for_update().get(pk=line.pk)
        if locked.config[CART]["state"] not in ("registered", "registration_rejected"):
            locked.config[CART].update(state=state, registration=confirmation)
            OrderItem.objects.filter(pk=locked.pk).update(config=locked.config)
            if state == "registered" and confirmation.get("registered_at") and confirmation.get("expires_at"):
                item = InvoiceItem.objects.select_for_update().get(
                    invoice__order=order, metadata__order_item_id=locked.pk)
                item.metadata["confirmed_period"] = {
                    "kind": "domain", "start": confirmation["registered_at"],
                    "end": confirmation["expires_at"],
                }
                item.save(update_fields=["metadata"])


def advance_cart(order, invoice):
    """Advance at most one stage per request and use the stored provider reference."""
    if order.status == "pending_payment" and invoice.status == "unpaid":
        if WebhookEvent.objects.filter(
                gateway__code="paystack", is_verified=True, event_type="charge.success",
                payload__intent_id__in=list(invoice.payment_intents.values_list("pk", flat=True))).exists():
            confirm_payment(order)
        return
    if order.status != "needs_review" or invoice.status != "void":
        return
    line = order.items.filter(item_type="domain", config__combined_domain_test_cart__state="awaiting_payment").order_by("pk").first()
    if line:
        reconcile_line(order, line.pk)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([DomainPurchaseThrottle])
def combined_cart(request):
    user = request.user
    if not selected_domain_test_account_allowed(user):
        raise NotFound()
    headers = {"Cache-Control": "private, no-store"}
    data = request.data
    action = data.get("action") if isinstance(data, dict) else None
    try:
        if action == "quote":
            return Response(quote_cart(user, data), headers=headers)
        if action == "accept":
            return Response(accept_cart(user, data), headers=headers)
        invoice_id = request.query_params.get("invoice", "")
        if not invoice_id.isascii() or not invoice_id.isdecimal() or len(invoice_id) > 18:
            raise NotFound()
        invoice = Invoice.objects.select_related("order").filter(
            pk=int(invoice_id), client=user, order__client=user, metadata__has_key=CART).first()
        if not invoice or invoice.metadata.get(CART) is not True:
            raise NotFound()
        order = invoice.order
        if request.method == "GET":
            return Response(cart_result(order, invoice), headers=headers)
        if action == "checkout":
            if pilot_readiness(user.pk):
                raise ValidationError("Domain test checkout is currently unavailable.")
            for line in order.items.filter(item_type="domain"):
                registrar(line.config[CART])
            intent, _ = reserve_hosted_checkout(invoice.pk, "paystack")
            return Response({"checkout_url": intent.authorization_url}, headers=headers)
        if action == "advance":
            advance_cart(order, invoice)
            order.refresh_from_db()
            return Response(cart_result(order), headers=headers)
        if action == "reconcile" and type(data.get("line_id")) is int:
            reconcile_line(order, data["line_id"])
            return Response(cart_result(order), headers=headers)
    except (CloudflareINT01Denied, CheckoutRefused, VaultUnavailable, IntegrationCredentialVersion.DoesNotExist):
        raise ValidationError("The test provider could not confirm this step. Check the existing order before retrying.") from None
    raise ValidationError("This cart action is unavailable.")
