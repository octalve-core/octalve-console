"""Signed gateway notification inbox — an event is NOT settlement proof.

The public ingress remains disabled without explicit release approval. For
accepted signed events, only bounded redacted gateway reference metadata is
stored. No invoice/order, transaction or hosting service is changed here.
Independent API readback is mandatory for settlement.
"""
import hashlib
import json
import re
from django.conf import settings
from django.db import transaction as db_transaction
from payments.models import PaymentGateway, PaymentIntent, WebhookEvent
from payments.signatures import verify_webhook_signature

REF = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{3,119}$")


class WebhookRejected(ValueError):
    pass


def accept_signed_event(gateway_code, raw_body, headers):
    if not getattr(settings, "CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED", False):
        raise WebhookRejected("Payment notification ingress is disabled.")
    if gateway_code not in ("paystack", "flutterwave"):
        raise WebhookRejected("Unapproved webhook gateway.")
    if not isinstance(raw_body, bytes) or not 0 < len(raw_body) <= 65536:
        raise WebhookRejected("Malformed or oversized webhook.")
    gateway = PaymentGateway.objects.filter(
        code=gateway_code, status="active", test_mode=False).first()
    if not gateway:
        raise WebhookRejected("Payment provider is unavailable.")
    secret = (gateway.get_secret_key() if gateway_code == "paystack"
              else gateway.get_webhook_secret())
    if not verify_webhook_signature(gateway_code, secret, headers, raw_body):
        raise WebhookRejected("Gateway signature could not be authenticated.")
    try:
        packet = json.loads(raw_body.decode("utf-8"))
    except (ValueError, UnicodeError) as exc:
        raise WebhookRejected("Webhook payload cannot be read.") from exc
    if not isinstance(packet, dict) or not isinstance(packet.get("data"), dict):
        raise WebhookRejected("Webhook payload is invalid.")
    event = packet.get("event")
    if event not in (("charge.success",) if gateway_code == "paystack"
                     else ("charge.completed",)):
        return None, False
    body = packet["data"]
    if gateway_code == "flutterwave" and body.get("status") != "successful":
        return None, False
    reference = body.get("reference") if gateway_code == "paystack" else body.get("tx_ref")
    remote_id = body.get("id")
    if (not isinstance(reference, str) or not REF.fullmatch(reference)
            or type(remote_id) not in (str, int) or not str(remote_id).isdigit()
            or len(str(remote_id)) > 35):
        raise WebhookRejected("Webhook transaction identity invalid.")
    # Unknown/refunded/expired references should be investigated via the
    # gateway but MUST NOT create settlement, accounts or redirect authority.
    intent = PaymentIntent.objects.filter(reference=reference, gateway=gateway).first()
    if intent is None:
        return None, False
    fingerprint = hashlib.sha256(
        f"{gateway.code}|{event}|{reference}|{remote_id}".encode("utf-8")).hexdigest()
    # Only minimal non-sensitive evidence is persisted. No raw payload/card,
    # customer email, cookie, auth header or full webhook headers are retained.
    with db_transaction.atomic():
        saved, created = WebhookEvent.objects.get_or_create(
            event_id="cloud_" + fingerprint,
            defaults={"gateway": gateway, "event_type": event,
                      "payload": {"intent_id": intent.pk, "reference": reference,
                                  "remote_id": str(remote_id)},
                      "headers": {}, "is_verified": True, "is_processed": False})
        if saved.gateway_id != gateway.pk or not saved.is_verified:
            raise WebhookRejected("Conflicting webhook event identity.")
        return saved, created
