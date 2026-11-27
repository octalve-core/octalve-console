"""One authorized sandbox domain purchase using the deployed Console."""
import json
import os
import re
from decimal import Decimal
from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import DatabaseError, transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import NotFound, Throttled, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle

from accounts.security_throttle import _spend as spend_durable_attempt
from billing.contact import billing_contact_snapshot
from billing.models import Invoice, InvoiceItem
from orders.models import Order, OrderItem
from payments.domain_pilot_scope import PILOT, pilot_configuration, pilot_gateway_allowed, pilot_test_gateway, selected_domain_test_allowed, public_domain_payment_test_allowed
from payments.hosted_checkout import CheckoutRefused, PreviousPaymentHeld, _return_url, reserve_hosted_checkout
from payments.models import PaymentGateway, PaymentIntent, WebhookEvent
from payments.readback import PaymentReadbackRejected, verify_gateway_intent
from payments.test_payment_evidence import consume_matching_test_event
from providers.cloudflare_int01 import CloudflareINT01, CloudflareINT01Denied, FixedCloudflareTransport
from providers.connection_audit import verify_chain
from providers.connection_models import IntegrationConnection, IntegrationCredentialVersion
from providers.connection_status import safe_verification_status, verification_receipts
from providers.connection_views import connection_database_qualified
from providers.connection_vault import VaultUnavailable, unseal_version

from .models import TLDPricing
from .public_registrar import query_published_registrar
from .tld_pricing_admin import rate_card_draft

QUOTE_SALT = "octalve.sandbox-domain-purchase.v1"


class DomainPurchaseThrottle(BaseThrottle):
    def allow_request(self, request, view):
        if request.method == "GET":
            return True
        if not request.user.is_authenticated or not request.user.is_active:
            return False
        try:
            retry = spend_durable_attempt("domains:sandbox_purchase", str(request.user.pk), 15, 300)
        except DatabaseError as exc:
            raise VaultUnavailable() from exc
        if retry:
            raise Throttled(wait=retry)
        return True


def registrar(snapshot=None):
    if (not settings.CLOUD_PROVIDER_CUSTODY_VERIFIED
            or not settings.CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED
            or settings.DEBUG or not connection_database_qualified()):
        raise VaultUnavailable()
    connection = IntegrationConnection.objects.filter(
        pk=os.getenv("CLOUD_DOMAIN_PILOT_REGISTRAR_ID") or None,
        adapter_key="cloudflare-registrar", state="draft", environment="test",
    ).first()
    if not connection or safe_verification_status(
            connection, verification_receipts([connection]))["verification_status"] != "verified":
        raise ValidationError("Verify the configured registrar sandbox connection first.")
    binding = {"connection": str(connection.pk), "version": connection.current_version}
    if snapshot is not None and snapshot["registrar"] != binding:
        raise ValidationError("The sandbox registrar connection changed.")
    verify_chain(connection)
    version = IntegrationCredentialVersion.objects.get(
        connection=connection, version=connection.current_version, revoked_at__isnull=True)
    token = unseal_version(version)["api_token"]
    return CloudflareINT01(connection.public_settings["account_id"], FixedCloudflareTransport(token)), binding


def registrant_contact():
    try:
        contact = json.loads(os.getenv("CLOUD_DOMAIN_PILOT_CONTACT_JSON", "null"))
        if not isinstance(contact, dict) or set(contact) != {"email", "phone", "postal_info"}:
            raise ValueError
        validate_email(contact["email"])
        if not re.fullmatch(r"\+[1-9][0-9]{0,2}\.[0-9]{4,14}", contact["phone"]):
            raise ValueError
        postal = contact["postal_info"]
        address = postal["address"]
        if set(postal) != {"name", "address"} or set(address) != {
                "street", "city", "state", "country_code", "postal_code"}:
            raise ValueError
        if not all(isinstance(field, str) and 1 <= len(field.strip()) <= 200
                   for field in [postal["name"], *address.values()]):
            raise ValueError
        if not re.fullmatch(r"[A-Z]{2}", address["country_code"]):
            raise ValueError
    except (DjangoValidationError, TypeError, ValueError, KeyError):
        raise ValidationError("Configure the sandbox registrant contact first.") from None
    return contact


def pilot_order(account, name):
    return Order.objects.filter(client_id=account, metadata__sandbox_domain_purchase__domain=name).first()


def result(order):
    invoice = order.invoices.get()
    evidence = order.metadata[PILOT]
    from payments.hosted_checkout import payment_attempt_summary
    from payments.hosted_checkout import payment_history
    try:
        intent, _ = payment_history(invoice)
    except CheckoutRefused:
        intent = None
    registration = evidence.get("registration", {}) if evidence["state"] == "registered" else {}
    attempt = payment_attempt_summary(invoice)
    checkout_state = {"not_started": "available", "resumable": "resume", "reconciliation_required": "uncertain", "retry_check": "retry_check"}[attempt["state"]]
    if checkout_state == "uncertain" and intent and intent.is_expired():
        checkout_state = "expired"
    from billing.payment_reference import verified_payment_details
    proof = verified_payment_details(invoice) or {}
    from .combined_cart import gateway_choices
    choices = gateway_choices(invoice.client, evidence.get("public_payment_test") is True, True) if evidence["state"] == "awaiting_payment" else []
    from payments.test_lifecycle import safe_snapshot
    return {"test_lifecycle": safe_snapshot(order), "gateway_options": choices, "payment_attempt_state": attempt["state"], "payment_verified": proof.get("test") is True, "verified_at": proof.get("verified_at"), "payment_gateway": proof.get("gateway"), "checkout_state": checkout_state, "order": order.order_number, "invoice": invoice.invoice_number,
            "invoice_id": invoice.pk, "invoice_public_id": str(invoice.public_id), "invoice_reference": invoice.public_reference, "order_reference": order.public_reference,
            "registered_at": registration.get("registered_at"), "expires_at": registration.get("expires_at"),
            "domain": evidence["domain"], "amount": str(invoice.total), "currency": "NGN",
            "state": evidence["state"], "payment_reference": evidence.get("payment_reference") or (intent.reference if intent else None)}


def _selected_rate(name, *, lock=False):
    cards = TLDPricing.objects.select_for_update() if lock else TLDPricing.objects
    card = cards.filter(tld="." + name.rsplit(".", 1)[1], status="active").first()
    route = card.metadata.get("published_registrar") if card and isinstance(card.metadata, dict) else None
    if not isinstance(route, dict) or card.register_price <= 0:
        raise ValidationError("This extension does not have a published registrar and price.")
    if type(route.get("revision")) is not int:
        raise ValidationError("This extension does not have a valid published rate revision.")
    return {"registration": {"1": str(card.register_price)}, "revision": route["revision"], "route": route}


def quote_domain(account, name, *, selected=False, public_payment_test=False):
    card = TLDPricing.objects.filter(tld=".com").first()
    rate = _selected_rate(name) if selected else rate_card_draft(card) if card else None
    if not rate or Decimal(rate["registration"]["1"]) <= 0:
        raise ValidationError("Set a positive one-year .com rate first.")
    if selected:
        if not public_payment_test:
            live = query_published_registrar(rate["route"], name)
            if not live or live.get("registrable") is not True:
                raise ValidationError("The live registrar did not confirm this name is available.")
    binding = None
    availability = None
    if not public_payment_test:
        supplier, binding = registrar()
        availability = supplier.check(name)
        if not availability["registrable"]:
            raise ValidationError("The domain is unavailable in the registrar sandbox.")
    snapshot = {"client": account, "domain": name, "amount": rate["registration"]["1"],
                "price_revision": rate["revision"],
                "registrar": binding, "supplier_quote": availability}
    if selected:
        snapshot.update(selected_domain=True, live_route=rate["route"])
    if public_payment_test:
        snapshot["public_payment_test"] = True
    return {"quote": signing.dumps(snapshot, salt=QUOTE_SALT), "domain": name,
            "amount": snapshot["amount"], "currency": "NGN", "years": 1}


@transaction.atomic
def accept_quote(user, name, token, *, selected=False, public_payment_test=False):
    # The account lock serializes pilot creation, including a double-submit.
    type(user).objects.select_for_update().get(pk=user.pk)
    existing = pilot_order(user.pk, name)
    if existing:
        return existing
    from payments.domain_pilot_scope import CART
    if OrderItem.objects.filter(order__client=user, item_type="domain", domain_name=name,
                                order__metadata__has_key=CART).exists():
        raise ValidationError("This domain belongs to a combined cart order. Open its invoice to continue.")
    try:
        snapshot = signing.loads(token, salt=QUOTE_SALT, max_age=300)
    except signing.BadSignature:
        raise ValidationError("This quote expired. Request a fresh quote.") from None
    if ((snapshot["client"], snapshot["domain"]) != (user.pk, name)
            or bool(snapshot.get("selected_domain")) != selected
            or bool(snapshot.get("public_payment_test")) != public_payment_test):
        raise ValidationError("This quote does not match the pilot account.")
    card = TLDPricing.objects.select_for_update().filter(tld=".com").first()
    rate = _selected_rate(name, lock=True) if selected else rate_card_draft(card) if card else None
    if (not rate or rate["registration"]["1"] != snapshot["amount"]
            or rate["revision"] != snapshot["price_revision"]
            or (selected and rate["route"] != snapshot.get("live_route"))):
        raise ValidationError("The price changed. Request a fresh quote.")
    if public_payment_test:
        if not public_domain_payment_test_allowed(user, name):
            raise NotFound()
        # Bound public trial records; serialized by the account lock above.
        if Order.objects.filter(client=user, metadata__sandbox_domain_purchase__public_payment_test=True).count() + Order.objects.filter(client=user, metadata__combined_domain_test_cart__public_payment_test=True).count() >= 3:
            raise ValidationError("Your public payment test limit has been reached.")
    else:
        from .sandbox_fulfillment import assert_private_domain_unclaimed
        assert_private_domain_unclaimed([name])
        registrar(snapshot)
    amount = Decimal(snapshot["amount"])
    label = (f"Payment test only: {name} (1 year)" if public_payment_test else f"Sandbox only: {name} registration (1 year)")
    contact = billing_contact_snapshot(user)
    order = Order.objects.create(client=user, status="pending_payment", subtotal=amount,
                                 total=amount, notes=label,
                                 metadata={PILOT: {**snapshot, "state": "awaiting_payment"}})
    OrderItem.objects.create(order=order, product_id=0, plan_id=0, billing_cycle_id=0,
                             item_type="domain", domain_name=name, description=label,
                             unit_price=amount, cycle_key="1yr", months=12)
    invoice = Invoice.objects.create(order=order, client=user, subtotal=amount,
                                     total=amount, notes=label,
                                     metadata={PILOT: True, "billing_contact": contact},
                                     due_date=timezone.now() + timezone.timedelta(days=1))
    InvoiceItem.objects.create(invoice=invoice, description=label, domain_name=name,
                               unit_price=amount, subtotal=amount,
                               quantity=1, period_start=invoice.issue_date,
                               period_end=invoice.issue_date + timezone.timedelta(days=365))
    return order


def pilot_readiness(account, *, public_payment_test=False, require_domain=True):
    issues = []
    if not get_user_model().objects.filter(
            pk=account, role="client", is_active=True, email_verified_at__isnull=False).exists():
        issues.append("The configured client account must be active and email verified.")
    if require_domain and not TLDPricing.objects.filter(tld=".com", register_price__gt=0).exists():
        issues.append("Save a positive one-year .com registration rate.")
    if not public_payment_test:
        try:
            registrar()
        except (CloudflareINT01Denied, VaultUnavailable, ValidationError,
                IntegrationCredentialVersion.DoesNotExist, DjangoValidationError, KeyError, ValueError):
            issues.append("Verify the configured Cloudflare Registrar Sandbox connection and vault.")
        try:
            registrant_contact()
        except ValidationError:
            issues.append("Configure the sandbox registrant contact on the API.")
    gateway = PaymentGateway.objects.filter(code="paystack").first()
    if not gateway or not pilot_test_gateway(gateway) or not gateway.get_secret_key():
        issues.append("Bind a currently verified Paystack Test Mode connection.")
    if not (settings.CLOUD_HOSTED_CHECKOUT_ENABLED and settings.CLOUD_GATEWAY_READBACK_ENABLED
            and settings.CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED):
        issues.append("Enable hosted checkout, gateway verification and signed webhook ingestion.")
    try:
        if urlsplit(_return_url()).netloc != urlsplit(settings.FRONTEND_URL).netloc:
            raise CheckoutRefused("Unexpected Console origin.")
    except CheckoutRefused:
        issues.append("Set the payment return URL to the Production Console origin.")
    return issues


def update_registration(order, state, **evidence):
    with transaction.atomic():
        locked = Order.objects.select_for_update().get(pk=order.pk)
        snapshot = locked.metadata[PILOT]
        if snapshot["state"] in {"registered", "registration_rejected"}:
            return
        snapshot.update(state=state, **evidence)
        locked.save(update_fields=["metadata", "updated_at"])


def reconcile_registration(order, supplier, workflow=None):
    domain = order.metadata[PILOT]["domain"]
    try:
        workflow = workflow or supplier.pilot_registration_status(domain)
    except CloudflareINT01Denied:
        # An unavailable readback cannot overwrite the last provider evidence.
        return
    state = workflow["state"]
    if state == "failed":
        update_registration(order, "registration_rejected")
    elif state == "action_required":
        update_registration(order, "registration_action_required")
    elif state == "succeeded":
        try:
            confirmation = supplier.get_registration(domain)
        except CloudflareINT01Denied:
            update_registration(order, "registration_pending")
            return
        if confirmation["sandbox_status"] == "active":
            update_registration(order, "registered", registration=confirmation)
        else:
            update_registration(order, "registration_pending")
    else:
        update_registration(order, "registration_pending")


def inspect_payment(order):
    from payments.hosted_checkout import payment_history
    intent, _ = payment_history(order.invoices.get())
    if intent and intent.gateway.code != "paystack":
        raise ValidationError("Payment needs verification.")
    if not intent:
        raise ValidationError("Start the Paystack test checkout first.")
    try:
        proof = verify_gateway_intent(intent, inspect_pilot=True)
    except PaymentReadbackRejected:
        raise ValidationError(
            "Paystack could not confirm the existing reference. Check that reference in Test Mode before taking any further action."
        ) from None
    if isinstance(proof, str):
        raise ValidationError(f"Paystack reports {proof}. The purchase still uses the existing test reference.")
    if not WebhookEvent.objects.filter(
            gateway=intent.gateway, is_verified=True, event_type="charge.success",
            payload__reference=proof.reference, payload__intent_id=intent.pk,
            payload__remote_id=proof.remote_id).exists():
        raise ValidationError("Paystack verified the payment. Waiting for the matching signed test webhook.")
    return intent, proof


def reconcile(order):
    snapshot = order.metadata[PILOT]
    public_test = snapshot.get("public_payment_test") is True
    if snapshot["state"] == "test_payment_verified":
        return
    if snapshot["state"] == "registered":
        if not snapshot.get("registration", {}).get("registered_at"):
            supplier, _ = registrar(snapshot)
            confirmation = supplier.get_registration(snapshot["domain"])
            if confirmation["sandbox_status"] == "active" and confirmation.get("registered_at"):
                with transaction.atomic():
                    locked = Order.objects.select_for_update().get(pk=order.pk)
                    if locked.metadata[PILOT]["state"] == "registered":
                        locked.metadata[PILOT]["registration"] = confirmation
                        locked.save(update_fields=["metadata", "updated_at"])
        return
    if snapshot["state"] == "registration_rejected":
        return
    supplier = None
    if not public_test:
        supplier, _ = registrar(snapshot)
    if snapshot["state"] != "awaiting_payment":
        if public_test:
            raise ValidationError("Unexpected public test state.")
        if recover_locally_blocked_submission(order, supplier):
            return
        reconcile_registration(order, supplier)
        return

    intent, proof = inspect_payment(order)
    contact = None if public_test else registrant_contact()
    with transaction.atomic():
        # Canonical lock order: invoice, intent, order, signed inbox event.
        invoice = Invoice.objects.select_for_update().get(pk=intent.invoice_id)
        payment = PaymentIntent.objects.select_for_update().get(pk=intent.pk)
        locked = Order.objects.select_for_update().get(pk=order.pk)
        if locked.metadata[PILOT]["state"] != "awaiting_payment":
            return
        from payments.hosted_checkout import payment_history
        active, _ = payment_history(invoice, lock=True)
        if not active or active.pk != payment.pk:
            raise ValidationError("Payment history requires verification.")
        if (not pilot_gateway_allowed(payment.gateway, invoice) or invoice.order_id != locked.pk
                or payment.invoice_id != invoice.pk or payment.client_id != invoice.client_id
                or locked.client_id != invoice.client_id or locked.currency != invoice.currency
                or locked.total != invoice.total
                or payment.status != intent.status or payment.reference != proof.reference
                or payment.amount != proof.amount or payment.currency != proof.currency
                or payment.gateway_id != intent.gateway_id
                or invoice.status != "unpaid" or invoice.amount_paid != 0
                or invoice.total != proof.amount or invoice.currency != proof.currency
                or locked.status != "pending_payment"):
            raise ValidationError("The pilot payment changed during verification.")
        verified_at = consume_matching_test_event(payment, proof)
        if not public_test:
            from .sandbox_fulfillment import assert_private_domain_unclaimed
            assert_private_domain_unclaimed([snapshot["domain"]], order_id=locked.pk)
        # Reserve before the POST. A crash at any point now requires readback only.
        locked.metadata[PILOT].update(state="test_payment_verified" if public_test else "registration_uncertain", payment_reference=proof.reference,
                                     payment_remote_id=proof.remote_id, payment_verified_at=verified_at.isoformat(), sandbox_submission_reserved=not public_test)
        from payments.test_lifecycle import record_confirmed_test
        record_confirmed_test(invoice, payment, locked, proof, verified_at)
        locked.status = "needs_review"
        locked.save(update_fields=["metadata", "status", "updated_at"])
        payment.status = "completed"
        payment.save(update_fields=["status"])
        invoice.status = "void"
        invoice.save(update_fields=["status", "updated_at"])
    if not public_test:
        submit_reserved_registration(locked, supplier, contact)


def submit_reserved_registration(order, supplier, contact):
    try:
        workflow = supplier.submit_pilot_registration(order, contact)
    except CloudflareINT01Denied:
        return
    reconcile_registration(order, supplier, workflow)


def recover_locally_blocked_submission(order, supplier):
    """One operator-scoped recovery for an order blocked before the old transport call."""
    if order.order_number != os.getenv("CLOUD_SANDBOX_LOCALLY_BLOCKED_ORDER"):
        return False
    legacy_scope = pilot_configuration()
    contact = registrant_contact()
    with transaction.atomic():
        locked = Order.objects.select_for_update().get(pk=order.pk)
        snapshot = locked.metadata[PILOT]
        if (snapshot.get("selected_domain") is not True or snapshot["state"] != "registration_uncertain"
                or "sandbox_submission_reserved" in snapshot or not legacy_scope
                or snapshot["domain"] == legacy_scope[1]):
            return False
        payment = PaymentIntent.objects.filter(
            invoice__order=locked, invoice__status="void", status="completed",
            reference=snapshot.get("payment_reference"), gateway__code="paystack",
        ).select_related("gateway", "invoice__client").first()
        if (not payment or payment.amount != payment.invoice.total
                or not pilot_gateway_allowed(payment.gateway, payment.invoice)
                or not WebhookEvent.objects.filter(
                    gateway=payment.gateway, is_verified=True, event_type="charge.success",
                    payload__reference=payment.reference, payload__intent_id=payment.pk,
                    payload__remote_id=snapshot.get("payment_remote_id"),
                ).exists()):
            return False
        snapshot["sandbox_submission_reserved"] = True
        locked.save(update_fields=["metadata", "updated_at"])
    submit_reserved_registration(locked, supplier, contact)
    return True


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([DomainPurchaseThrottle])
def domain_pilot(request):
    scope = pilot_configuration()
    user = request.user
    selected_name = request.query_params.get("domain")
    selected = selected_name is not None
    public_test = False
    if selected:
        name = selected_name.strip().lower()
        private_allowed = selected_domain_test_allowed(user, name)
        public_test = not private_allowed and public_domain_payment_test_allowed(user, name)
        scope = (user.pk, name) if private_allowed or public_test else None
    if not scope or not user.is_active:
        raise NotFound()
    account, name = scope
    is_client = user.pk == account and user.role == "client" and user.email_verified_at is not None
    is_admin = user.role == "admin" and user.is_superuser and user.is_staff and user.email_verified_at is not None
    if not is_client and not (is_admin and request.method == "GET"):
        raise NotFound()
    order = pilot_order(account, name)
    if order and bool(order.metadata[PILOT].get("public_payment_test")) != public_test:
        raise NotFound()
    exact_invoice = request.query_params.get("invoice")
    if exact_invoice is not None:
        if (not is_client or not order or not exact_invoice.isascii() or not exact_invoice.isdecimal()
                or len(exact_invoice) > 15 or exact_invoice.startswith("0")
                or order.invoices.count() != 1
                or not order.invoices.filter(pk=int(exact_invoice), client=user, metadata__sandbox_domain_purchase=True).exists()):
            raise NotFound()
    headers = {"Cache-Control": "private, no-store"}
    if request.method == "GET":
        return Response({"domain": name, "purchase": result(order) if order else None,
                         "public_payment_test": public_test,
                         "readiness_issues": pilot_readiness(account) if is_admin else None,
                         "payment_test_readiness_issues": pilot_readiness(account, public_payment_test=True) if is_admin else None}, headers=headers)
    if not isinstance(request.data, dict):
        raise ValidationError("Supply a purchase action.")
    action = request.data.get("action")
    if exact_invoice is not None and action not in ("checkout", "reconcile"):
        raise ValidationError("An existing invoice cannot create another order.")
    try:
        if public_test and action in ("quote", "checkout"):
            retry = spend_durable_attempt("domains:public_payment_test", "global", 100, 3600)
            if retry:
                raise Throttled(wait=retry)
        if action == "quote" and not order:
            if (pilot_readiness(account, public_payment_test=True) if public_test else pilot_readiness(account)):
                raise ValidationError("The test setup is incomplete. Check the Admin domain pricing preflight.")
            return Response(quote_domain(account, name, selected=selected, public_payment_test=public_test), headers=headers)
        if action == "accept" and isinstance(request.data.get("quote"), str):
            return Response(result(accept_quote(user, name, request.data["quote"], selected=selected, public_payment_test=public_test)), headers=headers)
        if action == "checkout" and order and order.metadata[PILOT]["state"] == "awaiting_payment":
            if not public_test:
                registrant_contact()
                registrar(order.metadata[PILOT])
            if request.data.get("gateway") != "paystack" or request.data.get("consent") is not True:
                raise ValidationError("Select Paystack and accept the terms to continue.")
            intent, _ = reserve_hosted_checkout(order.invoices.get().pk, "paystack", allow_test_retry=True)
            return Response({"checkout_url": intent.authorization_url}, headers=headers)
        if action == "reconcile" and order:
            reconcile(order)
            order.refresh_from_db()
            return Response(result(order), headers=headers)
    except PreviousPaymentHeld as exc:
        return Response({"code": exc.code, "detail": "Your previous payment needs confirmation. No new payment was started."}, status=409, headers=headers)
    except CheckoutRefused as exc:
        raise ValidationError("We could not safely open payment. Your invoice is saved. Please check your payment or contact support.") from exc
    except (CloudflareINT01Denied, VaultUnavailable, PaymentReadbackRejected,
            IntegrationCredentialVersion.DoesNotExist, DjangoValidationError, ValueError) as exc:
        raise ValidationError("We could not confirm your payment. Your invoice is saved. Please try again or contact support.") from exc
    raise ValidationError("This action is unavailable for the current purchase state.")
