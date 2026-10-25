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
from urllib.parse import urlsplit

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from billing.models import Invoice
from payments.models import PaymentGateway, PaymentIntent

REFERENCE = re.compile(r"^OC[A-Z0-9]{30}$")
ALLOWED_CHECKOUT = {"paystack": "checkout.paystack.com",
                    "flutterwave": "checkout.flutterwave.com"}


class CheckoutRefused(ValueError):
    pass


def _return_url():
    raw = getattr(settings, "CLOUD_PAYMENT_RETURN_URL", "")
    if not isinstance(raw, str) or not raw or len(raw) > 240:
        raise CheckoutRefused("Approved payment return URL is missing.")
    try:
        parsed = urlsplit(raw)
        if (parsed.scheme != "https" or parsed.hostname is None
                or parsed.username or parsed.password or parsed.port not in (None, 443)
                or parsed.query or parsed.fragment or not parsed.path.startswith("/")):
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
    secret = gateway.get_secret_key()
    if (gateway.code not in ALLOWED_CHECKOUT or gateway.status != "active"
            or gateway.test_mode or not isinstance(secret, str) or len(secret) < 16
            or secret.startswith(("sk_test_", "FLWSECK_TEST"))):
        raise CheckoutRefused("Authorized live gateway is unavailable.")
    invoice = intent.invoice
    email = invoice.client.email
    if not isinstance(email, str) or len(email) > 254 or "@" not in email:
        raise CheckoutRefused("Verified invoice contact email is required.")
    callback = _return_url()
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


def reserve_hosted_checkout(invoice_id, gateway_code, *, poster=None):
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
    with transaction.atomic():
        try:
            invoice = Invoice.objects.select_for_update().select_related(
                "order", "client").get(pk=invoice_id)
        except (Invoice.DoesNotExist, ValueError, TypeError):
            raise CheckoutRefused("Invoice not found.") from None
        if (not invoice.order_id or invoice.order.status != "pending_payment"
                or invoice.client_id != invoice.order.client_id
                or invoice.status != "unpaid" or invoice.amount_paid != 0
                or invoice.amount_due != invoice.total or invoice.total <= 0
                or invoice.total != invoice.order.total or invoice.currency != "NGN"):
            raise CheckoutRefused("Invoice is not eligible for hosted payment.")
        gateway = PaymentGateway.objects.filter(
            code=gateway_code, status="active", test_mode=False).first()
        if not gateway:
            raise CheckoutRefused("Approved payment provider unavailable.")
        _return_url()
        active = list(PaymentIntent.objects.select_for_update().filter(invoice=invoice))
        if active:
            # One live or ambiguous attempt per invoice; no other gateway can
            # be launched until a separate audited exception resolution.
            if len(active) != 1:
                raise CheckoutRefused("Multiple historical payment intents require review.")
            prior = active[0]
            if (prior.gateway_id != gateway.pk or prior.client_id != invoice.client_id
                    or prior.amount != invoice.total or prior.currency != invoice.currency
                    or prior.status not in ("pending", "processing")
                    or prior.is_expired()):
                raise CheckoutRefused("Existing payment attempt requires reconciliation.")
            state = prior.metadata.get("checkout_state") if isinstance(prior.metadata, dict) else None
            if state == "confirmed" and prior.authorization_url:
                return prior, False
            raise CheckoutRefused("Gateway initialization needs manual reconciliation.")
        issued = PaymentIntent.objects.create(
            invoice=invoice, client_id=invoice.client_id, gateway=gateway,
            reference="OC" + secrets.token_hex(15).upper(),
            status="processing", amount=invoice.total, currency=invoice.currency,
            expires_at=timezone.now() + timezone.timedelta(minutes=30),
            metadata={"checkout_state": "reserved"},
        )
    # POST is external and may have succeeded even when a timeout occurs.
    # NEVER retry or initiate another merchant ref automatically.
    link = _post_checkout(PaymentIntent.objects.select_related(
        "gateway", "invoice__client").get(pk=issued.pk), poster=poster)
    with transaction.atomic():
        locked = PaymentIntent.objects.select_for_update().get(pk=issued.pk)
        inv = Invoice.objects.select_for_update().get(pk=locked.invoice_id)
        if (locked.metadata.get("checkout_state") != "reserved"
                or locked.status != "processing" or locked.is_expired()
                or inv.status != "unpaid" or inv.amount_paid != 0
                or inv.total != locked.amount or inv.client_id != locked.client_id):
            raise CheckoutRefused("Invoice changed during gateway initialization.")
        locked.authorization_url = link
        locked.metadata = {"checkout_state": "confirmed"}
        locked.status = "pending"
        locked.save(update_fields=["authorization_url", "metadata", "status"])
        return locked, True
