"""Server-only hosted checkout creation with deterministic retry refusal.

All feature switches OFF by default. This module never debits a customer, never
settles an invoice, and never trusts a redirect. An unknown provider POST result
requires operator reconciliation by its stable merchant reference, NEVER a
blind second POST. Backend-generated intent/reference only.
"""
import json
import re
import secrets
from decimal import Decimal
from urllib.parse import urlencode, urlsplit

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from billing.models import Invoice
from payments.models import PaymentGateway, PaymentIntent, WebhookEvent
from payments.sandbox import gateway_can_read, secret_matches_mode
from payments.domain_pilot_scope import CART, PILOT, is_pilot_invoice, pilot_gateway_allowed

REFERENCE = re.compile(r"^OC[A-Z0-9]{30}$")
ALLOWED_CHECKOUT = {"paystack": "checkout.paystack.com",
                    "flutterwave": "checkout.flutterwave.com"}


class CheckoutRefused(ValueError):
    pass


class PreviousPaymentHeld(CheckoutRefused):
    """Safe customer-facing category; no raw gateway response."""
    def __init__(self, code):
        self.code = code
        super().__init__("Previous payment requires verification.")


PAYMENT_RETURN_PATHS = frozenset({
    "/client/payments/return", "/client/payments/return/",
    "/client/order/processing", "/client/order/processing/",
    "/client/order/checkout", "/client/order/checkout/",
})


def _return_url():
    raw = getattr(settings, "CLOUD_PAYMENT_RETURN_URL", "")
    if not isinstance(raw, str) or not raw or len(raw) > 240:
        raise CheckoutRefused("Approved payment return URL is missing.")
    try:
        parsed = urlsplit(raw)
        if (parsed.scheme != "https" or parsed.netloc != "console.cloud.octalve.com"
                or parsed.username or parsed.password or parsed.port not in (None, 443)
                or parsed.query or parsed.fragment or parsed.path not in PAYMENT_RETURN_PATHS
                or any(ord(char) < 33 or ord(char) == 127 for char in raw)):
            raise CheckoutRefused("Approved payment return URL is invalid.")
    except ValueError:
        raise CheckoutRefused("Approved payment return URL is invalid.") from None
    return raw


def _checkout_url(value, gateway):
    if not isinstance(value, str) or len(value) > 1200:
        raise CheckoutRefused("Gateway returned an invalid checkout link.")
    try:
        parsed = urlsplit(value)
        valid_path = (re.fullmatch(r"/[A-Za-z0-9_-]{8,150}", parsed.path)
                      if gateway == "paystack" else re.fullmatch(
                          r"/v3/hosted/pay/[A-Za-z0-9_-]{8,150}", parsed.path))
        if (parsed.scheme != "https" or parsed.hostname != ALLOWED_CHECKOUT[gateway]
                or parsed.username or parsed.password or parsed.port not in (None, 443)
                or parsed.fragment or parsed.query or not valid_path):
            raise CheckoutRefused("Gateway returned an unapproved checkout link.")
    except ValueError:
        raise CheckoutRefused("Gateway returned an unapproved checkout link.") from None
    return value


def _post_checkout(intent, *, poster=None):
    gateway = intent.gateway
    invoice = intent.invoice
    secret = gateway.get_secret_key()
    if (gateway.code not in ALLOWED_CHECKOUT or not gateway_can_read(gateway, invoice)
            or not secret_matches_mode(gateway, secret, invoice)):
        raise CheckoutRefused("Authorized live gateway is unavailable.")
    email = invoice.client.email
    if not isinstance(email, str) or len(email) > 254 or "@" not in email:
        raise CheckoutRefused("Verified invoice contact email is required.")
    callback = _return_url()
    # Every new hosted payment returns to the existing invoice, never a fresh cart.
    query = urlencode({"view": "invoice", "invoice": str(invoice.public_id), "returning": "1"})
    callback = urlsplit(callback)._replace(path="/client/order/checkout", query=query).geturl()
    if intent.currency != "NGN":
        # Other currencies require independently audited subunit conventions.
        raise CheckoutRefused("Only audited NGN payment initialization is supported.")
    if gateway.code == "paystack":
        kobo = intent.amount * 100
        if kobo != kobo.to_integral_value() or kobo <= 0:
            raise CheckoutRefused("NGN minor-unit conversion is invalid.")
        endpoint = "https://api.paystack.co/transaction/initialize"
        body = {"email": email, "amount": str(int(kobo)),
                "currency": "NGN", "reference": intent.reference,
                "callback_url": callback}
    else:
        endpoint = "https://api.flutterwave.com/v3/payments"
        body = {"tx_ref": intent.reference, "amount": str(intent.amount),
                "currency": "NGN", "redirect_url": callback,
                "customer": {"email": email}}
    answer = None
    try:
        send = poster or requests.post
        answer = send(endpoint, json=body, headers={
            "Authorization": "Bearer " + secret, "Content-Type": "application/json",
            "Accept": "application/json",
        }, timeout=8, allow_redirects=False, verify=True, stream=True)
        if answer.status_code not in (200, 201):
            raise CheckoutRefused("Gateway did not confirm hosted checkout.")
        size = answer.headers.get("Content-Length", "")
        if size and (not str(size).isdigit() or int(size) > 65536):
            raise CheckoutRefused("Gateway checkout response is too large.")
        packet = answer.raw.read(65537, decode_content=True)
        if len(packet) > 65536:
            raise CheckoutRefused("Gateway checkout response is too large.")
        data = json.loads(packet.decode("utf-8"))
        if not isinstance(data, dict) or not isinstance(data.get("data"), dict):
            raise CheckoutRefused("Gateway checkout response is invalid.")
        result = data["data"]
        if gateway.code == "paystack":
            if data.get("status") is not True or result.get("reference") != intent.reference:
                raise CheckoutRefused("Paystack returned a mismatched reference.")
            link = result.get("authorization_url")
        else:
            if data.get("status") != "success":
                raise CheckoutRefused("Flutterwave did not confirm the payment link.")
            link = result.get("link")
        return _checkout_url(link, gateway.code)
    except (requests.RequestException, OSError, UnicodeError, ValueError, TypeError) as exc:
        if isinstance(exc, CheckoutRefused):
            raise
        raise CheckoutRefused("Hosted checkout confirmation is uncertain.") from exc
    finally:
        if answer is not None:
            answer.close()


MAX_TEST_ATTEMPTS = 3


def payment_history(invoice, *, lock=False):
    """Keep old test references; only an explicitly superseded failed attempt is historical."""
    query = invoice.payment_intents.select_related("gateway").order_by("pk")
    if lock:
        query = invoice.payment_intents.select_for_update().order_by("pk")
    rows = list(query[:MAX_TEST_ATTEMPTS + 1])
    if len(rows) > MAX_TEST_ATTEMPTS:
        raise CheckoutRefused("Payment history requires review.")
    active, archived = [], []
    for row in rows:
        if (row.client_id != invoice.client_id or row.amount != invoice.total
                or row.currency != invoice.currency or not isinstance(row.metadata, dict)):
            raise CheckoutRefused("Payment history requires review.")
        if row.metadata.get("test_retry_superseded") is True:
            if (row.status != "failed" or row.metadata.get("verified_retry_status") not in ("abandoned", "failed")
                    or not pilot_gateway_allowed(row.gateway, invoice)):
                raise CheckoutRefused("Payment history requires review.")
            archived.append(row)
        else:
            active.append(row)
    if len(active) > 1 or (archived and not active):
        raise CheckoutRefused("Payment history requires review.")
    if archived and WebhookEvent.objects.filter(is_verified=True, event_type="charge.success",
            gateway_id__in=[r.gateway_id for r in archived], payload__intent_id__in=[r.pk for r in archived]).exists():
        raise CheckoutRefused("An earlier payment needs verification.")
    return (active[0] if active else None), archived


def test_retry_candidate(invoice, prior, archived):
    return bool(prior and prior.status == "pending" and prior.is_expired()
                and prior.metadata.get("checkout_state") == "confirmed"
                and len(archived) + 1 < MAX_TEST_ATTEMPTS
                and invoice.status == "unpaid" and invoice.amount_paid == 0
                and pilot_gateway_allowed(prior.gateway, invoice)
                and not WebhookEvent.objects.filter(gateway_id=prior.gateway_id, is_verified=True,
                    event_type="charge.success", payload__intent_id=prior.pk).exists())


def payment_attempt_summary(invoice):
    """Safe metadata only; no hosted URL/reference or credential disclosure."""
    try:
        prior, archived = payment_history(invoice)
    except CheckoutRefused:
        return {"state": "reconciliation_required", "gateway": None}
    if not prior:
        return {"state": "not_started", "gateway": None}
    resume = (prior.status == "pending" and not prior.is_expired()
              and prior.metadata.get("checkout_state") == "confirmed"
              and prior.gateway.code in ALLOWED_CHECKOUT)
    if resume:
        try:
            _checkout_url(prior.authorization_url, prior.gateway.code)
        except CheckoutRefused:
            resume = False
    state = "resumable" if resume else "retry_check" if test_retry_candidate(invoice, prior, archived) else "reconciliation_required"
    return {"state": state, "gateway": prior.gateway.code if prior.gateway.code in ALLOWED_CHECKOUT else None,
            "test": prior.gateway.test_mode}


def reserve_hosted_checkout(invoice_id, gateway_code, *, poster=None, allow_test_retry=False):
    """No duplicate external POST for one invoice and gateway.

    Under the invoice lock, reserve one pending intent and stable reference.
    A rerun returns the original confirmed link; an unresolved attempt is
    deliberately blocked for manual provider reconciliation. No expiry-based
    automatic duplicate POST is permitted, including after a network timeout.
    """
    if not getattr(settings, "CLOUD_HOSTED_CHECKOUT_ENABLED", False):
        raise CheckoutRefused("Hosted payment initialization is disabled.")
    if not isinstance(gateway_code, str) or gateway_code not in ALLOWED_CHECKOUT:
        raise CheckoutRefused("Unsupported hosted gateway.")
    retry_proof = None
    # A local timeout is never a failure verdict. Read the same test reference
    # before acquiring the write lock; do not hold a DB lock during network I/O.
    if allow_test_retry and gateway_code == "paystack":
        candidate = Invoice.objects.select_related("client", "order").filter(pk=invoice_id).first()
        if candidate:
            prior, archived = payment_history(candidate)
            if test_retry_candidate(candidate, prior, archived):
                from payments.readback import verify_gateway_intent, PaymentReadbackRejected
                try:
                    status = verify_gateway_intent(prior, inspect_pilot=True)
                except PaymentReadbackRejected:
                    raise PreviousPaymentHeld("verification_unavailable") from None
                if status not in ("abandoned", "failed"):
                    raise PreviousPaymentHeld("previous_payment_pending")
                retry_proof = (prior.pk, prior.reference, status, prior.expires_at)
    with transaction.atomic():
        try:
            invoice = Invoice.objects.select_for_update().select_related("client").get(pk=invoice_id)
        except (Invoice.DoesNotExist, ValueError, TypeError):
            raise CheckoutRefused("Invoice not found.") from None
        if (not invoice.order_id or invoice.order.status != "pending_payment"
                or invoice.client_id != invoice.order.client_id
                or invoice.status != "unpaid" or invoice.amount_paid != 0
                or invoice.amount_due != invoice.total or invoice.total <= 0
                or invoice.total != invoice.order.total or invoice.currency != "NGN"):
            raise CheckoutRefused("Invoice is not eligible for hosted payment.")
        if (invoice.order.metadata.get("live_domain_registration_v1") or invoice.order.metadata.get("registrar_renewal_v1")) and gateway_code!="paystack":
            raise CheckoutRefused("Live registrar orders require Paystack.")
        gateway = PaymentGateway.objects.select_for_update().filter(code=gateway_code).first()
        if not gateway or not gateway_can_read(gateway, invoice):
            raise CheckoutRefused("Approved payment provider unavailable.")
        live_binding = gateway.code=="paystack" and not gateway.test_mode and "provider_vault_connection_id" in gateway.config
        if invoice.order.metadata.get("live_domain_registration_v1"):
            from domains.live_registration import enabled as registrar_enabled,KEY,SALT
            from domains.models import Domain
            from django.core import signing
            from providers.registrar_live_policy import load
            from providers.connection_vault import VaultUnavailable
            from providers.connection_models import IntegrationConnection, IntegrationCredentialVersion
            try:
                domain=Domain.objects.select_for_update().get(pk=invoice.order.metadata[KEY]["domain_id"],
                    client_id=invoice.client_id,order_item__order_id=invoice.order_id,status="pending")
                grant=signing.loads(domain.metadata[KEY]["grant"],salt=SALT)
                if (not live_binding or not registrar_enabled() or domain.metadata[KEY]["state"]!="queued"
                    or grant["order"]!=invoice.order_id or grant["owner"]!=invoice.client_id
                    or Decimal(grant["retail"])!=invoice.total):
                    raise CheckoutRefused("Live registration payment is unavailable.")
                load(grant["route"])
            except (Domain.DoesNotExist,IntegrationConnection.DoesNotExist,IntegrationCredentialVersion.DoesNotExist,VaultUnavailable,signing.BadSignature,ValueError,KeyError,TypeError):
                raise CheckoutRefused("Live registrar authority changed.") from None
        if invoice.order.metadata.get("registrar_renewal_v1"):
            from domains.resellerclub_renewals import payment_ready,ERRORS
            try:
                if not live_binding or not payment_ready(invoice): raise CheckoutRefused("Renewal payment unavailable.")
            except ERRORS:
                raise CheckoutRefused("Renewal authority changed.") from None
        if live_binding:
            from .live_reconciliation import enabled as live_enabled
            from .live_binding import resolve_live_key
            if not live_enabled() or not resolve_live_key(gateway):
                raise CheckoutRefused("Live reconciliation and credential authority are unavailable.")
        _return_url()
        prior, archived = payment_history(invoice, lock=True)
        if prior:
            if (prior.gateway_id != gateway.pk or prior.client_id != invoice.client_id
                    or prior.amount != invoice.total or prior.currency != invoice.currency):
                raise CheckoutRefused("Existing payment attempt requires reconciliation.")
            if live_binding and (prior.metadata.get("payment_mode")!="live" or prior.metadata.get("gateway_binding")!=gateway.config):
                raise CheckoutRefused("Existing payment attempt belongs to another authority.")
            state = prior.metadata.get("checkout_state")
            if prior.status == "pending" and not prior.is_expired() and state == "confirmed" and prior.authorization_url:
                _checkout_url(prior.authorization_url, gateway.code)
                return prior, False
            if (not retry_proof or not allow_test_retry or not test_retry_candidate(invoice, prior, archived)
                    or retry_proof[:2] != (prior.pk, prior.reference) or retry_proof[3] != prior.expires_at):
                raise CheckoutRefused("Existing payment attempt requires reconciliation.")
            # Sandbox ONLY. Old reference is retained and any late signed success
            # blocks subsequent settlement. Never retry live or uncertain POSTs.
            prior.status = "failed"
            prior.metadata = {**prior.metadata, "test_retry_superseded": True,
                              "verified_retry_status": retry_proof[2],
                              "verified_retry_at": timezone.now().isoformat()}
            prior.save(update_fields=["status", "metadata"])
        issued = PaymentIntent.objects.create(
            invoice=invoice, client_id=invoice.client_id, gateway=gateway,
            reference="OC" + secrets.token_hex(15).upper(),
            status="processing", amount=invoice.total, currency=invoice.currency,
            expires_at=timezone.now() + timezone.timedelta(minutes=30),
            metadata={"checkout_state": "reserved", **({"payment_mode":"live","gateway_binding":gateway.config} if live_binding else {})},
        )
    # POST is external and may have succeeded even when a timeout occurs.
    # NEVER retry or initiate another merchant ref automatically.
    link = _post_checkout(PaymentIntent.objects.select_related(
        "gateway", "invoice__client").get(pk=issued.pk), poster=poster)
    with transaction.atomic():
        inv = Invoice.objects.select_for_update().get(pk=issued.invoice_id)
        locked = PaymentIntent.objects.select_for_update().get(pk=issued.pk)
        if (locked.invoice_id != inv.pk or locked.metadata.get("checkout_state") != "reserved"
                or locked.status != "processing" or locked.is_expired()
                or inv.status != "unpaid" or inv.amount_paid != 0
                or inv.total != locked.amount or inv.client_id != locked.client_id):
            raise CheckoutRefused("Invoice changed during gateway initialization.")
        locked.authorization_url = link
        locked.metadata = {**locked.metadata,"checkout_state": "confirmed"}
        locked.status = "pending"
        locked.save(update_fields=["authorization_url", "metadata", "status"])
        return locked, True
