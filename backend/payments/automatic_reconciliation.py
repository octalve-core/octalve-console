"""Automatic server-side test reconciliation, separate from fulfillment.

The signed inbox is durable. Webhook delivery and the protected scheduled
worker share one dispatcher; the existing invoice/intent/order locks are
the idempotency boundary. Historical evidence is audited, never replayed.
"""
from django.db import DatabaseError
from django.db.models import F, Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .domain_pilot_scope import CART, PILOT, pilot_gateway_allowed
from .historical_test_reconciliation import reconcile_historical_test
from .hosted_checkout import CheckoutRefused
from .models import PaymentIntent, WebhookEvent
from .readback import PaymentReadbackRejected

RETRY_PREFIX = "automatic_reconciliation_retry:"

def enabled():
    from .test_lifecycle import enabled as lifecycle_enabled
    from django.conf import settings
    return bool(lifecycle_enabled()
                and getattr(settings, "CLOUD_GATEWAY_READBACK_ENABLED", False)
                and getattr(settings, "CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED", False))

def consume_test_event(event_id):
    """Only authenticated Paystack TEST evidence may enter this dispatcher."""
    if not enabled():
        return "disabled"
    event = WebhookEvent.objects.filter(pk=event_id, is_verified=True,
        event_type="charge.success", gateway__code="paystack",
        gateway__test_mode=True, gateway__status="test").first()
    if not event:
        return "ignored"
    if event.is_processed:
        return "processed"
    data = event.payload
    if not isinstance(data, dict) or type(data.get("intent_id")) is not int:
        return "held"
    intent = PaymentIntent.objects.select_related("invoice__order", "invoice__client", "gateway").filter(
        pk=data["intent_id"], reference=data.get("reference"), gateway_id=event.gateway_id).first()
    if not intent or not intent.invoice.order_id:
        return "held"
    invoice, order = intent.invoice, intent.invoice.order
    markers = [key for key in (CART, PILOT) if invoice.metadata.get(key) is True
               and isinstance(order.metadata.get(key), dict)]
    if len(markers) != 1 or not pilot_gateway_allowed(intent.gateway, invoice):
        return "held"
    if intent.status == "completed" and invoice.status == "void":
        reconcile_historical_test(event.pk)
    elif intent.status in ("pending", "processing") and invoice.status == "unpaid":
        if markers[0] == CART:
            from domains.combined_cart import confirm_payment
            confirm_payment(order)
        else:
            from domains.pilot import reconcile
            reconcile(order, payment_only=True)
    else:
        return "held"
    return "processed" if WebhookEvent.objects.filter(pk=event.pk, is_processed=True).exists() else "held"

def attempt_event(event_id):
    """Keep retry state redacted; a concurrent success must never be overwritten."""
    try:
        result = consume_test_event(event_id)
    except (ValidationError, DatabaseError, CheckoutRefused, PaymentReadbackRejected):
        if WebhookEvent.objects.filter(pk=event_id, is_processed=True).exists():
            return "processed"
        result = "held"
    if result == "held":
        WebhookEvent.objects.filter(pk=event_id, is_verified=True, is_processed=False,
            gateway__code="paystack", gateway__test_mode=True).update(
            error_message=RETRY_PREFIX+timezone.now().isoformat())
    return result

def due_event_ids(*, historical, limit=2):
    """Separate lanes prevent old or conflicting evidence starving new payments.
    
    Unattempted events first, then least recently attempted. All writes are
    bounded and a conflicting event remains unprocessed for review.
    """
    if not enabled():
        return []
    intents = PaymentIntent.objects.filter(gateway__code="paystack", gateway__test_mode=True,
        gateway__status="test").filter(Q(invoice__metadata__combined_domain_test_cart=True) |
        Q(invoice__metadata__sandbox_domain_purchase=True))
    if historical:
        intents = intents.filter(status="completed", invoice__status="void",
                                 invoice__order__status="needs_review")
    else:
        intents = intents.filter(status__in=("pending","processing"), invoice__status="unpaid",
                                 invoice__order__status="pending_payment")
    # Bound candidate work by inbox, not the number of old intents.
    return list(WebhookEvent.objects.filter(is_verified=True,is_processed=False,
        event_type="charge.success",gateway__code="paystack",gateway__test_mode=True,
        payload__intent_id__in=intents.values("pk")).order_by(
        F("error_message").asc(nulls_first=True),"pk").values_list("pk",flat=True)[:limit])
