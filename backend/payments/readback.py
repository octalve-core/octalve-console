"""Strict, independently authenticated payment readback. Does NOT settle accounts.

Called only by an audited backend settlement consumer in a future accepted release.
No browser /verify or webhook endpoint invokes this module. A payment event,
redirect, or success-looking JSON is never sufficient. The reference and amount
MUST match a server-created PaymentIntent and the gateway's own verified response.
"""
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from urllib.parse import quote

import requests
from django.conf import settings


class PaymentReadbackRejected(ValueError):
    """Generic failure: never expose the gateway key or raw payload."""


@dataclass(frozen=True)
class ConfirmedGatewayPayment:
    gateway: str
    reference: str
    currency: str
    amount: Decimal
    remote_id: str


REFERENCE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{3,119}$")


def _money(value):
    if isinstance(value, bool) or not isinstance(value, (str, int, Decimal)):
        raise PaymentReadbackRejected("Gateway amount format invalid.")
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise PaymentReadbackRejected("Gateway amount format invalid.") from exc
    if not amount.is_finite() or amount <= 0 or amount.as_tuple().exponent < -2:
        raise PaymentReadbackRejected("Gateway amount format invalid.")
    return amount


def verify_gateway_intent(intent, *, getter=None):
    """Exactly one bounded read-only GET, fixed HTTPS origin, no redirects.

    The caller must lock and revalidate the PaymentIntent/invoice before
    writing ANY settlement record. This function performs ZERO DB writes.
    """
    if not getattr(settings, "CLOUD_GATEWAY_READBACK_ENABLED", False):
        raise PaymentReadbackRejected("Gateway readback is disabled.")
    if not intent or not getattr(intent, "gateway", None) or not getattr(intent, "invoice", None):
        raise PaymentReadbackRejected("Unknown server-issued payment intent.")
    gateway, invoice = intent.gateway, intent.invoice
    order = invoice.order
    if (gateway.code not in ("paystack", "flutterwave") or gateway.status != "active"
            or gateway.test_mode or intent.status not in ("pending", "processing")
            or intent.is_expired() or invoice.status not in ("unpaid", "partially_paid")
            or not order or order.status != "pending_payment"
            or invoice.client_id != intent.client_id or order.client_id != intent.client_id
            or invoice.currency != intent.currency or invoice.currency != order.currency
            or invoice.total <= 0 or invoice.amount_paid != 0
            or _money(intent.amount) != _money(invoice.total)):
        raise PaymentReadbackRejected("Payment intent or financial ownership is ineligible.")
    ref = intent.reference
    if not isinstance(ref, str) or not REFERENCE.fullmatch(ref):
        raise PaymentReadbackRejected("Gateway payment reference is invalid.")
    secret = gateway.get_secret_key()
    if not isinstance(secret, str) or len(secret) < 16:
        raise PaymentReadbackRejected("Gateway credential is not configured.")
    if secret.startswith(("sk_test_", "FLWSECK_TEST")):
        raise PaymentReadbackRejected("Test-mode gateway credentials are not valid for settlement.")
    if gateway.code == "paystack":
        url = "https://api.paystack.co/transaction/verify/" + quote(ref, safe="")
        query = None
    else:
        url = "https://api.flutterwave.com/v3/transactions/verify_by_reference"
        query = {"tx_ref": ref}
    response = None
    try:
        fetch = getter or requests.get
        response = fetch(url, params=query,
                         headers={"Authorization": "Bearer " + secret,
                                  "Accept": "application/json"},
                         timeout=8, verify=True, allow_redirects=False, stream=True)
        if response.status_code != 200:
            raise PaymentReadbackRejected("Gateway payment verification was rejected.")
        size = response.headers.get("Content-Length", "")
        if size and (not str(size).isdigit() or int(size) > 65536):
            raise PaymentReadbackRejected("Gateway verification response oversized.")
        data_bytes = response.raw.read(65537, decode_content=True)
        if len(data_bytes) > 65536:
            raise PaymentReadbackRejected("Gateway verification response oversized.")
        import json
        packet = json.loads(data_bytes.decode("utf-8"), parse_float=Decimal)
        if not isinstance(packet, dict):
            raise PaymentReadbackRejected("Gateway verification response invalid.")
        data = packet.get("data")
        if not isinstance(data, dict):
            raise PaymentReadbackRejected("Gateway verification response invalid.")
        if gateway.code == "paystack":
            if packet.get("status") is not True or data.get("status") != "success":
                raise PaymentReadbackRejected("Paystack did not confirm settlement.")
            if data.get("domain") == "test" or data.get("reference") != ref:
                raise PaymentReadbackRejected("Paystack verified another transaction.")
            # Paystack returns amounts in integer minor units (kobo for NGN).
            minor = data.get("amount")
            if isinstance(minor, bool) or type(minor) is not int or minor < 1:
                raise PaymentReadbackRejected("Invalid Paystack minor-unit amount.")
            amount = Decimal(minor) / Decimal(100)
            remote_id = data.get("id")
        else:
            if packet.get("status") != "success" or data.get("status") != "successful":
                raise PaymentReadbackRejected("Flutterwave did not confirm settlement.")
            if data.get("tx_ref") != ref:
                raise PaymentReadbackRejected("Flutterwave verified another transaction.")
            amount = _money(data.get("amount"))
            remote_id = data.get("id")
        if (data.get("currency") != intent.currency
                or amount != _money(intent.amount)
                or (type(remote_id) is not int and not isinstance(remote_id, str))
                or not str(remote_id).isdigit()):
            raise PaymentReadbackRejected("Verified gateway identity, amount or currency mismatch.")
        return ConfirmedGatewayPayment(
            gateway.code, ref, intent.currency, amount, str(remote_id))
    except (requests.RequestException, ValueError, TypeError, KeyError,
            UnicodeError, OSError, OverflowError) as exc:
        if isinstance(exc, PaymentReadbackRejected):
            raise
        raise PaymentReadbackRejected("Independent gateway verification failed.") from exc
    finally:
        if response is not None:
            response.close()
