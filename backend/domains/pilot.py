"""One authorized sandbox domain purchase using the deployed Console."""
import json
import os
import re
from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from billing.models import Invoice, InvoiceItem
from orders.models import Order, OrderItem
from payments.domain_pilot_scope import PILOT, pilot_configuration, pilot_test_gateway
from payments.hosted_checkout import CheckoutRefused, _return_url, reserve_hosted_checkout
from payments.models import PaymentGateway, PaymentIntent, WebhookEvent
from payments.readback import PaymentReadbackRejected, verify_gateway_intent
from providers.cloudflare_int01 import CloudflareINT01, CloudflareINT01Denied, FixedCloudflareTransport
from providers.connection_audit import verify_chain
from providers.connection_models import IntegrationConnection, IntegrationCredentialVersion
from providers.connection_status import safe_verification_status, verification_receipts
from providers.connection_views import VaultMutationThrottle, connection_database_qualified
from providers.connection_vault import VaultUnavailable, unseal_version

from .models import TLDPricing

QUOTE_SALT = "octalve.sandbox-domain-purchase.v1"


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
    intent = invoice.payment_intents.first()
    checkout_state = "available"
    if intent:
        checkout_state = ("expired" if intent.is_expired() else
                          "resume" if intent.authorization_url else "uncertain")
    return {"checkout_state": checkout_state, "order": order.order_number, "invoice": invoice.invoice_number,
            "domain": evidence["domain"], "amount": str(invoice.total), "currency": "NGN",
            "state": evidence["state"], "payment_reference": evidence.get("payment_reference") or (intent.reference if intent else None)}


def quote_domain(account, name):
    card = TLDPricing.objects.filter(tld=".com").first()
    if not card or card.register_price <= 0:
        raise ValidationError("Set a positive one-year .com rate first.")
    supplier, binding = registrar()
    availability = supplier.check(name)
    if not availability["registrable"]:
        raise ValidationError("The domain is unavailable in the registrar sandbox.")
    snapshot = {"client": account, "domain": name, "amount": str(card.register_price),
                "price_revision": card.metadata.get("period_pricing_v1", {}).get("revision", 0),
                "registrar": binding, "supplier_quote": availability}
    return {"quote": signing.dumps(snapshot, salt=QUOTE_SALT), "domain": name,
            "amount": snapshot["amount"], "currency": "NGN", "years": 1}


@transaction.atomic
def accept_quote(user, name, token):
    # The account lock serializes pilot creation, including a double-submit.
    type(user).objects.select_for_update().get(pk=user.pk)
    existing = pilot_order(user.pk, name)
    if existing:
        return existing
    try:
        snapshot = signing.loads(token, salt=QUOTE_SALT, max_age=300)
    except signing.BadSignature:
        raise ValidationError("This quote expired. Request a fresh quote.") from None
    if (snapshot["client"], snapshot["domain"]) != (user.pk, name):
        raise ValidationError("This quote does not match the pilot account.")
    card = TLDPricing.objects.select_for_update().filter(tld=".com").first()
    if (not card or str(card.register_price) != snapshot["amount"]
            or card.metadata.get("period_pricing_v1", {}).get("revision", 0) != snapshot["price_revision"]):
        raise ValidationError("The price changed. Request a fresh quote.")
    registrar(snapshot)
    label = f"Sandbox only: {name} registration (1 year)"
    order = Order.objects.create(client=user, status="pending_payment", subtotal=card.register_price,
                                 total=card.register_price, notes=label,
                                 metadata={PILOT: {**snapshot, "state": "awaiting_payment"}})
    OrderItem.objects.create(order=order, product_id=0, plan_id=0, billing_cycle_id=0,
                             item_type="domain", domain_name=name, description=label,
                             unit_price=card.register_price, cycle_key="1yr", months=12)
    invoice = Invoice.objects.create(order=order, client=user, subtotal=card.register_price,
                                     total=card.register_price, notes=label, metadata={PILOT: True},
                                     due_date=timezone.now() + timezone.timedelta(days=1))
    InvoiceItem.objects.create(invoice=invoice, description=label, domain_name=name,
                               unit_price=card.register_price, subtotal=card.register_price,
                               quantity=1, period_start=invoice.issue_date,
                               period_end=invoice.issue_date + timezone.timedelta(days=365))
    return order


def pilot_readiness(account):
    issues = []
    if not get_user_model().objects.filter(
            pk=account, role="client", is_active=True, email_verified_at__isnull=False).exists():
        issues.append("The configured client account must be active and email verified.")
    if not TLDPricing.objects.filter(tld=".com", register_price__gt=0).exists():
        issues.append("Save a positive one-year .com registration rate.")
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
    intent = PaymentIntent.objects.filter(invoice__order=order, gateway__code="paystack").first()
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
    if snapshot["state"] in {"registered", "registration_rejected"}:
        return
    supplier, _ = registrar(snapshot)
    if snapshot["state"] != "awaiting_payment":
        reconcile_registration(order, supplier)
        return

    intent, proof = inspect_payment(order)
    contact = registrant_contact()
    with transaction.atomic():
        locked = Order.objects.select_for_update().get(pk=order.pk)
        if locked.metadata[PILOT]["state"] != "awaiting_payment":
            return
        # Keep the lock order aligned with reserve_hosted_checkout.
        invoice = Invoice.objects.select_for_update().get(pk=intent.invoice_id)
        payment = PaymentIntent.objects.select_for_update().get(pk=intent.pk)
        if (payment.status != intent.status or payment.reference != proof.reference
                or payment.amount != proof.amount or payment.currency != proof.currency
                or payment.gateway_id != intent.gateway_id
                or invoice.status != "unpaid" or invoice.amount_paid != 0
                or invoice.total != proof.amount or invoice.currency != proof.currency
                or locked.status != "pending_payment"):
            raise ValidationError("The pilot payment changed during verification.")
        # Reserve before the POST. A crash at any point now requires readback only.
        locked.metadata[PILOT].update(state="registration_uncertain", payment_reference=proof.reference,
                                     payment_remote_id=proof.remote_id)
        locked.status = "needs_review"
        locked.save(update_fields=["metadata", "status", "updated_at"])
        payment.status = "completed"
        payment.save(update_fields=["status"])
        invoice.status = "void"
        invoice.save(update_fields=["status", "updated_at"])
    try:
        workflow = supplier.submit_pilot_registration(snapshot["domain"], contact)
    except CloudflareINT01Denied:
        return
    reconcile_registration(order, supplier, workflow)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([VaultMutationThrottle])
def domain_pilot(request):
    scope = pilot_configuration()
    user = request.user
    if not scope or not user.is_active:
        raise NotFound()
    account, name = scope
    is_client = user.pk == account and user.role == "client" and user.email_verified_at is not None
    is_admin = user.role == "admin" and user.is_superuser and user.is_staff and user.email_verified_at is not None
    if not is_client and not (is_admin and request.method == "GET"):
        raise NotFound()
    order = pilot_order(account, name)
    headers = {"Cache-Control": "private, no-store"}
    if request.method == "GET":
        return Response({"domain": name, "purchase": result(order) if order else None,
                         "readiness_issues": pilot_readiness(account) if is_admin else None}, headers=headers)
    if not isinstance(request.data, dict):
        raise ValidationError("Supply a purchase action.")
    action = request.data.get("action")
    try:
        if action == "quote" and not order:
            if pilot_readiness(account):
                raise ValidationError("The test setup is incomplete. Check the Admin domain pricing preflight.")
            return Response(quote_domain(account, name), headers=headers)
        if action == "accept" and isinstance(request.data.get("quote"), str):
            return Response(result(accept_quote(user, name, request.data["quote"])), headers=headers)
        if action == "checkout" and order and order.metadata[PILOT]["state"] == "awaiting_payment":
            registrant_contact()
            registrar(order.metadata[PILOT])
            intent, _ = reserve_hosted_checkout(order.invoices.get().pk, "paystack")
            return Response({"checkout_url": intent.authorization_url}, headers=headers)
        if action == "reconcile" and order:
            reconcile(order)
            order.refresh_from_db()
            return Response(result(order), headers=headers)
    except (CloudflareINT01Denied, VaultUnavailable, CheckoutRefused, PaymentReadbackRejected,
            IntegrationCredentialVersion.DoesNotExist, DjangoValidationError, ValueError) as exc:
        raise ValidationError("The sandbox provider could not confirm this step. Check the purchase status before retrying.") from exc
    raise ValidationError("This action is unavailable for the current purchase state.")
