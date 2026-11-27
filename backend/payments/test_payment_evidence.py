"""Test-only confirmation evidence. Never posts financial settlement."""
from django.db import connection
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .models import Transaction, WebhookEvent


def consume_matching_test_event(payment, proof):
    """Called inside the caller's invoice/intent/order transaction.

    A signed notification alone is not sufficient: the proof is the independent
    gateway readback already validated by the caller. Exactly one inbox row
    must match the current intent, gateway, reference and remote identity.
    """
    if not connection.in_atomic_block:
        raise RuntimeError("Test confirmation requires an atomic transaction.")
    if (payment.gateway.code != "paystack" or not payment.gateway.test_mode
            or payment.gateway.status != "test" or proof.gateway != "paystack"
            or payment.reference != proof.reference or payment.currency != proof.currency
            or payment.amount != proof.amount or payment.status not in ("pending", "processing")
            or Transaction.objects.filter(invoice_id=payment.invoice_id).exists()):
        raise ValidationError("Payment evidence changed before confirmation.")
    events = list(WebhookEvent.objects.select_for_update().filter(
        gateway_id=payment.gateway_id, is_verified=True, event_type="charge.success",
        payload__intent_id=payment.pk, payload__reference=proof.reference).order_by("pk")[:2])
    if len(events) != 1 or events[0].is_processed or events[0].payload.get("remote_id") != proof.remote_id:
        raise ValidationError("Exactly one unprocessed matching signed payment notification is required.")
    event = events[0]
    now = timezone.now()
    event.is_processed = True
    event.processed_at = now
    event.error_message = None
    event.save(update_fields=["is_processed", "processed_at", "error_message"])
    return now
