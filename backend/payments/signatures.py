"""Fail-closed, gateway-specific webhook signatures. A signature is NOT payment proof."""
import hashlib
import hmac


def verify_webhook_signature(gateway_code, secret, headers, raw_body):
    if not isinstance(secret, str) or not secret.strip() or not isinstance(raw_body, bytes):
        return False
    normalized = {str(key).lower(): str(value) for key, value in headers.items()}
    if gateway_code == "paystack":
        provided = normalized.get("x-paystack-signature", "")
        if not provided:
            return False
        expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha512).hexdigest()
        return hmac.compare_digest(expected, provided)
    if gateway_code == "flutterwave":
        # This backend calls Flutterwave v3; v4 requires a separate HMAC contract.
        provided = normalized.get("verif-hash", "")
        return bool(provided) and hmac.compare_digest(secret, provided)
    return False
