"""Google Pay review-only capability for Octalve Cloud.

This module deliberately does not create, charge, verify, or settle a payment.
It exposes only the non-secret configuration needed to render Google's official
TEST button against an exact client-owned unpaid invoice.

The money-moving path stays closed until the Paystack custom Google Pay
PAN_ONLY transaction-ID contract is independently confirmed and accepted.
"""
import re
from decimal import Decimal

from django.conf import settings

from billing.models import Invoice
from payments.models import PaymentGateway


IDENTIFIER = re.compile(r"^[A-Za-z0-9_-]{2,64}$")
MERCHANT_ID = re.compile(r"^[A-Za-z0-9]{12,32}$")


class GooglePayReviewRefused(ValueError):
    pass


def _clean_text(value, *, maximum):
    if not isinstance(value, str):
        return ""
    cleaned = value.strip()
    if not cleaned or len(cleaned) > maximum:
        return ""
    return cleaned


def _review_configuration():
    if not getattr(settings, "CLOUD_GOOGLE_PAY_REVIEW_ENABLED", False):
        return None

    # There is intentionally no charge implementation in this release. If an
    # operator tries to turn on the future flag early, fail closed rather than
    # implying that browser wallet success can settle an invoice.
    if getattr(settings, "CLOUD_GOOGLE_PAY_CHARGE_ENABLED", False):
        raise GooglePayReviewRefused(
            "Google Pay charging is not qualified for this release."
        )

    merchant_name = _clean_text(
        getattr(settings, "CLOUD_GOOGLE_PAY_MERCHANT_NAME", ""),
        maximum=80,
    )
    gateway_merchant_id = _clean_text(
        getattr(settings, "CLOUD_PAYSTACK_INTEGRATION_ID", ""),
        maximum=64,
    )
    merchant_id = _clean_text(
        getattr(settings, "CLOUD_GOOGLE_PAY_MERCHANT_ID", ""),
        maximum=32,
    )

    if not merchant_name or not IDENTIFIER.fullmatch(gateway_merchant_id):
        raise GooglePayReviewRefused(
            "Google Pay review configuration is incomplete."
        )
    if merchant_id and not MERCHANT_ID.fullmatch(merchant_id):
        raise GooglePayReviewRefused(
            "Google Pay merchant identifier is invalid."
        )

    gateway = PaymentGateway.objects.filter(code="paystack").first()
    if gateway is None:
        raise GooglePayReviewRefused("Paystack gateway record is unavailable.")

    return {
        "merchant_name": merchant_name,
        "merchant_id": merchant_id or None,
        "gateway_merchant_id": gateway_merchant_id,
    }


def google_pay_review_for_invoice(invoice_id, client):
    config = _review_configuration()
    if config is None:
        return {"enabled": False, "review_only": True, "charge_enabled": False}

    try:
        invoice = Invoice.objects.select_related("client").get(
            pk=invoice_id,
            client=client,
        )
    except (Invoice.DoesNotExist, ValueError, TypeError):
        raise GooglePayReviewRefused("Invoice not found.") from None

    if (
        getattr(client, "role", None) != "client"
        or invoice.status != "unpaid"
        or invoice.currency != "NGN"
        or invoice.total <= Decimal("0")
        or invoice.amount_paid != Decimal("0")
        or invoice.amount_due != invoice.total
    ):
        raise GooglePayReviewRefused(
            "Invoice is not eligible for Google Pay review."
        )

    merchant_info = {"merchantName": config["merchant_name"]}
    if config["merchant_id"]:
        merchant_info["merchantId"] = config["merchant_id"]

    return {
        "enabled": True,
        "review_only": True,
        "charge_enabled": False,
        "environment": "TEST",
        "processor": "paystack",
        "merchant_info": merchant_info,
        "tokenization": {
            "type": "PAYMENT_GATEWAY",
            "parameters": {
                "gateway": "paystack",
                "gatewayMerchantId": config["gateway_merchant_id"],
            },
        },
        "allowed_auth_methods": ["CRYPTOGRAM_3DS", "PAN_ONLY"],
        "allowed_card_networks": ["VISA", "MASTERCARD"],
        "billing_address_required": True,
        "assurance_details_required": True,
        "transaction_info": {
            "countryCode": "NG",
            "currencyCode": "NGN",
            "totalPriceStatus": "FINAL",
            "totalPrice": format(invoice.amount_due, ".2f"),
        },
    }
