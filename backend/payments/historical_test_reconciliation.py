"""Audited historical test notification reconciliation; no settlement or fulfillment."""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from audit.models import AuditLog
from billing.models import Invoice
from orders.models import Order
from .domain_pilot_scope import CART, PILOT, pilot_gateway_allowed
from .hosted_checkout import CheckoutRefused, payment_history
from .models import PaymentIntent, Transaction, WebhookEvent
from .readback import ConfirmedGatewayPayment, PaymentReadbackRejected, verify_gateway_intent

def _context(event, invoice, intent, order):
    keys = [k for k in (PILOT, CART) if invoice.metadata.get(k) is True and k in order.metadata]
    if len(keys) != 1:
        raise ValidationError("Historical order marker is ambiguous.")
    state = order.metadata[keys[0]]
    payload = event.payload
    if (not isinstance(state, dict) or not isinstance(payload, dict)
            or event.event_type != "charge.success" or not event.is_verified
            or event.gateway_id != intent.gateway_id or payload.get("intent_id") != intent.pk
            or payload.get("reference") != intent.reference
            or invoice.order_id != order.pk or invoice.client_id != intent.client_id
            or order.client_id != invoice.client_id or invoice.status != "void"
            or order.status != "needs_review" or intent.status != "completed"
            or intent.amount != invoice.total or order.total != invoice.total
            or intent.currency != invoice.currency or order.currency != invoice.currency
            or invoice.amount_paid != 0 or Transaction.objects.filter(invoice=invoice).exists()
            or not pilot_gateway_allowed(intent.gateway, invoice)
            or state.get("payment_reference") != intent.reference):
        raise ValidationError("Historical test evidence is inconsistent.")
    remote = payload.get("remote_id")
    if (not isinstance(remote, str) or not remote.isascii() or not remote.isdecimal()
            or len(remote) > 35 or state.get("payment_remote_id") not in (None, "", remote)):
        raise ValidationError("Historical remote identity conflicts.")
    active, _ = payment_history(invoice)
    if not active or active.pk != intent.pk:
        raise ValidationError("Historical payment attempt is ambiguous.")
    return remote

def reconcile_historical_test(event_id, actor=None):
    """Fresh provider readback first, then lock and compare original evidence.

    Store a new reconciliation receipt, never invent an old verification timestamp
    or change order metadata. An audit receipt is not permission to fulfill.
    """
    event = WebhookEvent.objects.filter(pk=event_id, is_verified=True, is_processed=False).first()
    if not event or not isinstance(event.payload, dict) or type(event.payload.get("intent_id")) is not int:
        raise ValidationError("Unprocessed historical notification not found.")
    intent = PaymentIntent.objects.select_related("invoice__order", "invoice__client", "gateway").filter(
        pk=event.payload["intent_id"], gateway_id=event.gateway_id).first()
    if not intent or not intent.invoice.order_id:
        raise ValidationError("Historical invoice not found.")
    invoice, order = intent.invoice, intent.invoice.order
    try:
        remote = _context(event, invoice, intent, order)
        proof = verify_gateway_intent(intent, inspect_pilot=True, historical_test=True)
        if not isinstance(proof, ConfirmedGatewayPayment) or (proof.gateway, proof.reference, proof.remote_id,
                proof.amount, proof.currency) != ("paystack", intent.reference, remote, intent.amount, intent.currency):
            raise ValidationError("Fresh test readback did not match the signed notification.")
        with transaction.atomic():
            invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
            intent = PaymentIntent.objects.select_for_update().get(pk=intent.pk)
            order = Order.objects.select_for_update().get(pk=order.pk)
            events = list(WebhookEvent.objects.select_for_update().filter(
                gateway_id=intent.gateway_id, is_verified=True, event_type="charge.success",
                payload__intent_id=intent.pk, payload__reference=intent.reference).order_by("pk")[:2])
            if len(events) != 1 or events[0].pk != event_id or events[0].is_processed:
                raise ValidationError("Historical signed notification is ambiguous or already processed.")
            event = events[0]
            if _context(event, invoice, intent, order) != proof.remote_id or (
                    intent.reference, intent.amount, intent.currency) != (proof.reference, proof.amount, proof.currency):
                raise ValidationError("Historical evidence changed during verification.")
            # Preserve historical order metadata, financial balances, and original payment status.
            # Reconciliation is recorded separately and MUST NOT enable supplier writes.
            receipt = AuditLog.objects.create(actor=actor, action="settings_updated",
                entity_type="HistoricalTestPayment", entity_id=str(event.pk),
                entity_name=invoice.public_reference, details={"test": True, "read_only": True,
                    "source": "automatic_server_reconciliation" if actor is None else "operator_reconciliation",
                    "independent_verification": True, "reference": proof.reference,
                    "remote_id": proof.remote_id, "amount": str(proof.amount), "currency": proof.currency,
                    "fulfillment_authorized": False, "verified_at": timezone.now().isoformat()})
            event.is_processed = True
            event.processed_at = timezone.now()
            event.error_message = None
            event.save(update_fields=["is_processed", "processed_at", "error_message"])
        return {"event": event_id, "status": "reconciled", "invoice_reference": invoice.public_reference,
                "audit_receipt": receipt.pk, "fulfillment_authorized": False}
    except (CheckoutRefused, PaymentReadbackRejected):
        raise ValidationError("Independent historical test evidence could not be confirmed.") from None
