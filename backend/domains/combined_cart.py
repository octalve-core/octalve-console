"""Combined Test Mode orders. Each domain has its own submission reservation."""
from django.utils import timezone
from decimal import Decimal
from uuid import UUID

from django.core import signing
from django.db import transaction
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import NotFound, ValidationError, Throttled
from accounts.security_throttle import _spend as spend_durable_attempt
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from billing.contact import billing_contact_snapshot
from billing.models import Invoice, InvoiceItem
from orders.models import Order, OrderItem
from orders.shopping_cart import MAX_CHECKOUT_DOMAINS
from orders.serializers import CreateOrderSerializer
from payments.domain_pilot_scope import (
    CART, PILOT, pilot_gateway_allowed, selected_domain_test_account_allowed, selected_domain_test_allowed,
    public_payment_test_account_allowed, public_domain_payment_test_allowed,
)
from payments.hosted_checkout import CheckoutRefused, PreviousPaymentHeld, reserve_hosted_checkout, payment_attempt_summary
from django.db import DatabaseError
from payments.models import PaymentIntent, WebhookEvent
from payments.test_payment_evidence import consume_matching_test_event
from providers.cloudflare_int01 import CloudflareINT01Denied
from providers.connection_models import IntegrationCredentialVersion
from providers.connection_vault import VaultUnavailable

from .pilot import (
    DomainPurchaseThrottle, _selected_rate, inspect_payment, pilot_readiness,
    quote_domain, registrar, registrant_contact,
)

SALT = "octalve.combined-domain-test-cart.v1"


def selections(user, data, *, public_test=False):
    domains = data.get("domains")
    services = data.get("services", [])
    allowed = public_domain_payment_test_allowed if public_test else selected_domain_test_allowed
    if not isinstance(domains, list) or not all(isinstance(name, str) for name in domains):
        raise ValidationError("Choose valid domain names.")
    if len(domains) > MAX_CHECKOUT_DOMAINS:
        raise ValidationError(f"Test checkout supports up to {MAX_CHECKOUT_DOMAINS} domains per order. Return to your cart and remove {len(domains) - MAX_CHECKOUT_DOMAINS} domain(s).")
    if not public_test and not domains:
        raise ValidationError("The registrar sandbox requires a domain.")
    if len(set(domains)) != len(domains):
        raise ValidationError("Remove duplicate domain names from your cart.")
    if not all(allowed(user, name) for name in domains):
        raise ValidationError("One or more domains are not eligible for this test checkout. Only eligible .com registrations are supported.")
    if not isinstance(services, list) or not 1 <= len(domains) + len(services) <= 20:
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
        {"name": line["domain"], "amount": line["amount"], "kind": "domain", "period": "1 year"}
        for line in domains
    ] + [
        {"name": item["description"], "amount": str(item["unit_price"] * item["quantity"]),
         "kind": item["item_type"], "domain": item.get("domain_name", ""), "period": item["billing_cycle"].label}
        for item in services
    ]


def basket_total(lines):
    return sum((Decimal(line["amount"]) for line in lines), Decimal("0.00"))


def existing_domain_order(user, names):
    return OrderItem.objects.filter(
        order__client=user, item_type="domain", domain_name__in=names,
    ).filter(Q(order__metadata__has_key=PILOT) | Q(order__metadata__has_key=CART)).exists()


def gateway_choices(user, public_test, require_domain):
    # This checkout currently has exactly one qualified provider contract.
    try:
        ready = not pilot_readiness(user.pk, public_payment_test=public_test, require_domain=require_domain)
    except (CloudflareINT01Denied, CheckoutRefused, VaultUnavailable, IntegrationCredentialVersion.DoesNotExist, DatabaseError, ValidationError):
        ready = False
    return [{"code": "paystack", "enabled": ready, "test": True},
            *({"code": code, "enabled": False} for code in ("flutterwave", "monnify", "google_pay"))]


def start_cart_payment(user, invoice):
    order = invoice.order
    public_test = order.metadata[CART].get("public_payment_test") is True
    if public_test:
        retry = spend_durable_attempt("domains:public_payment_test", "global", 100, 3600)
        if retry:
            raise Throttled(wait=retry)
        if pilot_readiness(user.pk, public_payment_test=True, require_domain=bool(order.metadata[CART]["domains"])):
            raise ValidationError("Test payment is temporarily unavailable. Your invoice is preserved.")
    else:
        if pilot_readiness(user.pk):
            raise ValidationError("Domain test checkout is currently unavailable.")
        for line in order.items.filter(item_type="domain"):
            registrar(line.config[CART])
    intent, _ = reserve_hosted_checkout(invoice.pk, "paystack", allow_test_retry=True)
    return intent.authorization_url


def require_payment_consent(data):
    if data.get("consent") is not True:
        raise ValidationError("Accept the terms of service and acknowledge the privacy policy to continue.")
    if data.get("gateway") != "paystack":
        raise ValidationError("This payment method is not available.")


def payment_response(user, invoice):
    # Invoice issuance has already committed. Return its identity even if gateway initialization fails.
    result = cart_result(invoice.order, invoice)
    if result["payment_verified"]:
        return result
    try:
        link = start_cart_payment(user, invoice)
        invoice.refresh_from_db()
        result = cart_result(invoice.order, invoice)
        if result["payment_attempt_state"] == "resumable" and not result["payment_verified"]:
            result["checkout_url"] = link
        elif not result["payment_verified"]:
            result["checkout_error"] = "Your existing payment needs confirmation. No further payment has been started."
    except (CloudflareINT01Denied, CheckoutRefused, VaultUnavailable, IntegrationCredentialVersion.DoesNotExist, DatabaseError, ValidationError, Throttled) as exc:
        invoice.refresh_from_db()
        refreshed = cart_result(invoice.order, invoice)
        result["payment_started"] = refreshed["payment_started"]
        result["payment_attempt_state"] = refreshed["payment_attempt_state"]
        result["checkout_error"] = ("Your previous payment needs confirmation. No new payment was started." if isinstance(exc, PreviousPaymentHeld) else "We couldn’t open secure payment. Your invoice is saved. Please try again or contact support.")
        if isinstance(exc, PreviousPaymentHeld):
            result["checkout_hold"] = True
    return result


def quote_cart(user, data):
    public_test = public_payment_test_account_allowed(user)
    names, services = selections(user, data, public_test=public_test)
    if not public_test and existing_domain_order(user, names):
        raise ValidationError("A domain already has an order. Resume it from your invoices.")
    if not public_test and pilot_readiness(user.pk):
        raise ValidationError("Domain test checkout is currently unavailable.")
    from .pilot import QUOTE_SALT
    domains = [signing.loads(quote_domain(user.pk, name, selected=True, public_payment_test=True)["quote"] if public_test else quote_domain(user.pk, name, selected=True)["quote"], salt=QUOTE_SALT)
               for name in names]
    with transaction.atomic():
        items = services_for(services)
        lines = lines_for(domains, items)
    return {"lines": lines, "total": str(basket_total(lines)), "currency": "NGN", "public_payment_test": public_test,
            "gateway_options": gateway_choices(user, public_test, bool(names)),
            "quote": signing.dumps({"client": user.pk, "domains": domains,
                                    "services": services, "lines": lines, "public_payment_test": public_test}, salt=SALT)}


@transaction.atomic
def accept_cart(user, data):
    try:
        key = str(UUID(data["checkout_id"]))
    except (ValueError, TypeError, KeyError, AttributeError):
        raise ValidationError("A checkout reference is required.") from None
    type(user).objects.select_for_update().get(pk=user.pk)
    existing = Order.objects.filter(client=user, metadata__combined_domain_test_cart__checkout_id=key).first()
    if existing:
        existing_public = existing.metadata[CART].get("public_payment_test") is True
        if not (public_payment_test_account_allowed(user) if existing_public else selected_domain_test_account_allowed(user)):
            raise NotFound()
        return cart_result(existing)
    try:
        snapshot = signing.loads(data.get("quote", ""), salt=SALT, max_age=300)
    except (signing.BadSignature, TypeError):
        raise ValidationError("The cart quote expired. Review the current prices.") from None
    if snapshot["client"] != user.pk:
        raise NotFound()
    public_test = snapshot.get("public_payment_test") is True
    if public_test and not public_payment_test_account_allowed(user):
        raise NotFound()
    if not public_test and not selected_domain_test_account_allowed(user):
        raise NotFound()
    if public_test and Order.objects.filter(client=user, metadata__combined_domain_test_cart__public_payment_test=True).count() + Order.objects.filter(client=user, metadata__sandbox_domain_purchase__public_payment_test=True).count() >= 3:
        raise ValidationError("Your public payment test limit has been reached.")
    domains = snapshot["domains"]
    names, services = selections(user, {"domains": [item["domain"] for item in domains],
                                        "services": snapshot["services"]}, public_test=public_test)
    if not public_test and existing_domain_order(user, names):
        raise ValidationError("A domain already has an order. Resume it from your invoices.")
    for domain in domains:
        rate = _selected_rate(domain["domain"], lock=True)
        if (domain["amount"] != rate["registration"]["1"]
                or domain["price_revision"] != rate["revision"]
                or domain["live_route"] != rate["route"]):
            raise ValidationError("Domain pricing changed. Review the current prices.")
        if not public_test:
            registrar(domain)
    if not public_test:
        from .sandbox_fulfillment import assert_private_domain_unclaimed
        assert_private_domain_unclaimed(names)
    items = services_for(services)
    lines = lines_for(domains, items)
    if lines != snapshot["lines"]:
        raise ValidationError("Service pricing changed. Review the current prices.")
    total = basket_total(lines)
    contact = billing_contact_snapshot(user)
    order = Order.objects.create(client=user, source="web", status="pending_payment", currency="NGN",
                                 subtotal=total, total=total, notes="Payment test only — no service activation" if public_test else "Test order",
                                 metadata={CART: {"checkout_id": key, "domains": names, "public_payment_test": public_test},
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
    if invoice.total != total or sum((line.subtotal for line in invoice.items.all()), Decimal("0.00")) != total:
        raise ValidationError("The invoice amount does not match the accepted quotation.")
    return cart_result(order, invoice)


def cart_result(order, invoice=None):
    invoice = invoice or order.invoices.get()
    from billing.payment_reference import verified_payment_details
    evidence = verified_payment_details(invoice) or {}
    attempt = payment_attempt_summary(invoice)
    attempt_state = "verified" if evidence.get("test") is True else attempt["state"]
    from payments.test_lifecycle import safe_snapshot
    return {"test_lifecycle": safe_snapshot(order), "invoice_id": invoice.pk, "invoice_public_id": str(invoice.public_id), "invoice_reference": invoice.public_reference, "order_reference": order.public_reference, "invoice": invoice.invoice_number, "order": order.order_number,
            "payment_reference": evidence.get("reference"), "payment_gateway": evidence.get("gateway"),
            "verified_at": evidence.get("verified_at"),
            "total": str(invoice.total), "currency": invoice.currency,
            "payment_verified": evidence.get("test") is True,
            "public_payment_test": order.metadata[CART].get("public_payment_test") is True,
            "lines": [{"name": line.description, "amount": str(line.subtotal), "kind": line.item_type, "domain": line.domain_name, "period": line.cycle_key} for line in order.items.all()],
            "payment_started": attempt["state"] != "not_started", "payment_attempt_state": attempt_state,
            "domains": [{"id": line.pk, "name": line.domain_name,
                         "state": "test_payment_verified" if order.metadata[CART].get("public_payment_test") is True and invoice.status == "void" and order.metadata[CART].get("payment_reference") else line.config[CART]["state"],
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
        from payments.hosted_checkout import payment_history
        active, _ = payment_history(invoice, lock=True)
        if not active or active.pk != payment.pk:
            raise ValidationError("Payment history requires verification.")
        if (not pilot_gateway_allowed(payment.gateway, invoice) or invoice.order_id != locked.pk
                or payment.invoice_id != invoice.pk or payment.client_id != invoice.client_id
                or locked.client_id != invoice.client_id or locked.currency != invoice.currency
                or invoice.status != "unpaid" or invoice.amount_paid != 0
                or locked.status != "pending_payment" or payment.status not in ("pending", "processing")
                or payment.reference != proof.reference or payment.amount != proof.amount
                or payment.currency != proof.currency or payment.gateway_id != intent.gateway_id
                or invoice.total != proof.amount or locked.total != proof.amount or invoice.currency != proof.currency):
            raise ValidationError("The payment changed during verification.")
        verified_at = consume_matching_test_event(payment, proof)
        locked.metadata[CART]["payment_reference"] = proof.reference
        locked.metadata[CART]["payment_remote_id"] = proof.remote_id
        locked.metadata[CART]["payment_verified_at"] = verified_at.isoformat()
        from payments.test_lifecycle import record_confirmed_test
        record_confirmed_test(invoice, payment, locked, proof, verified_at)
        locked.status = "needs_review"
        locked.save(update_fields=["metadata", "status", "updated_at"])
        payment.status = "completed"
        payment.save(update_fields=["status"])
        invoice.status = "void"
        invoice.save(update_fields=["status", "updated_at"])


def reconcile_line(order, line_id):
    if order.metadata[CART].get("public_payment_test") is True:
        raise ValidationError("Payment-only tests never submit registrations.")
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
            from .sandbox_fulfillment import assert_private_domain_unclaimed
            assert_private_domain_unclaimed([locked.domain_name], order_id=order.pk)
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
    if order.metadata[CART].get("public_payment_test") is True:
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
    if not (selected_domain_test_account_allowed(user) or public_payment_test_account_allowed(user)):
        raise NotFound()
    headers = {"Cache-Control": "private, no-store"}
    data = request.data
    action = data.get("action") if isinstance(data, dict) else None
    try:
        if action == "quote":
            if public_payment_test_account_allowed(user):
                retry = spend_durable_attempt("domains:public_payment_test", "global", 100, 3600)
                if retry:
                    raise Throttled(wait=retry)
            return Response(quote_cart(user, data), headers=headers)
        if action == "accept":
            return Response(accept_cart(user, data), headers=headers)
        if action == "pay":
            require_payment_consent(data)
            if not request.query_params.get("invoice"):
                accepted = accept_cart(user, data)
                invoice = Invoice.objects.select_related("order").get(pk=accepted["invoice_id"], client=user, order__client=user)
                return Response(payment_response(user, invoice), headers=headers)
        invoice_id = request.query_params.get("invoice", "")
        if not invoice_id.isascii() or not invoice_id.isdecimal() or len(invoice_id) > 18:
            raise NotFound()
        invoice = Invoice.objects.select_related("order").filter(
            pk=int(invoice_id), client=user, order__client=user, metadata__has_key=CART).first()
        if not invoice or invoice.metadata.get(CART) is not True:
            raise NotFound()
        order = invoice.order
        public_test = order.metadata[CART].get("public_payment_test") is True
        if not (public_payment_test_account_allowed(user) if public_test else selected_domain_test_account_allowed(user)):
            raise NotFound()
        if request.method == "GET":
            result = cart_result(order, invoice)
            if not result["payment_verified"]:
                result["gateway_options"] = gateway_choices(user, public_test, bool(order.metadata[CART]["domains"]))
            return Response(result, headers=headers)
        if action == "pay":
            return Response(payment_response(user, invoice), headers=headers)
        if action == "checkout":
            require_payment_consent(data)
            return Response({"checkout_url": start_cart_payment(user, invoice)}, headers=headers)
        if action == "advance":
            advance_cart(order, invoice)
            order.refresh_from_db()
            return Response(cart_result(order), headers=headers)
        if action == "reconcile" and type(data.get("line_id")) is int:
            reconcile_line(order, data["line_id"])
            return Response(cart_result(order), headers=headers)
    except (CloudflareINT01Denied, CheckoutRefused, VaultUnavailable, IntegrationCredentialVersion.DoesNotExist, DatabaseError):
        raise ValidationError("The test provider could not confirm this step. Check the existing order before retrying.") from None
    raise ValidationError("This cart action is unavailable.")
