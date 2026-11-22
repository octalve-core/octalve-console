"""Explicit test-gateway read-only lane: never financial or hosting authority.

This is for isolated gateway API acceptance, not live payment collection.
Enabling test-provider verification does not enable settlement, provisioning,
OPanel grants or remote account creation. The generic review lane excludes
Production. One separately authorized domain pilot invoice can use Paystack Test Mode.
"""
import os
from .domain_pilot_scope import is_pilot_invoice, pilot_gateway_allowed
from django.conf import settings


def sandbox_review_allowed(gateway):
    return bool(
        getattr(gateway, "test_mode", False) is True
        and gateway.status in ("test", "active")
        and getattr(settings, "CLOUD_GATEWAY_SANDBOX_READBACK_ENABLED", False) is True
        and getattr(settings, "CLOUD_ISOLATED_REVIEW_CONFIRMED", False) is True
        and os.environ.get("VERCEL_ENV", "").lower() != "production"
        and (
            (os.environ.get("VERCEL_ENV", "").lower() == "preview")
            or bool(getattr(settings, "DEBUG", False))
        )
    )


def gateway_can_read(gateway, invoice=None):
    if is_pilot_invoice(invoice):
        return pilot_gateway_allowed(gateway, invoice)
    return bool(
        gateway.code in ("paystack", "flutterwave")
        and ((gateway.status == "active" and not gateway.test_mode)
             or sandbox_review_allowed(gateway))
    )


def secret_matches_mode(gateway, secret, invoice=None):
    if not isinstance(secret, str) or len(secret) < 16:
        return False
    is_test_secret = (secret.startswith("sk_test_") if gateway.code == "paystack"
                      else secret.startswith("FLWSECK_TEST"))
    if gateway.test_mode:
        return gateway_can_read(gateway, invoice) and is_test_secret
    return gateway.status == "active" and not is_test_secret
