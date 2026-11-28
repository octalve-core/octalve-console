"""Single-writer payment settlement after independent provider API confirmation.

No HTTP endpoint calls this module. Default OFF; an authorized backend consumer
may enable it only after keys, webhook transport and live tests are accepted.
The HTTPS call occurs OUTSIDE the DB transaction, then everything is rechecked
while row-locked. A duplicate verification is a pure idempotent read.
"""
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction as db_transaction
from django.utils import timezone

from billing.models import Invoice
from orders.models import Order
from payments.models import PaymentIntent, Transaction, PaymentGateway, WebhookEvent
from payments.readback import PaymentReadbackRejected, verify_gateway_intent


class SettlementRefused(ValueError):
    pass


def _signed_event(event_id,intent,remote_id):
    if event_id is None:
        return None
    event=WebhookEvent.objects.select_for_update().filter(pk=event_id,is_verified=True,event_type="charge.success",gateway_id=intent.gateway_id).first()
    if (not event or not isinstance(event.payload,dict) or event.payload.get("mode")!="live"
            or event.payload.get("intent_id")!=intent.pk or event.payload.get("reference")!=intent.reference
            or event.payload.get("remote_id")!=remote_id or event.payload.get("binding")!=intent.gateway.config
            or intent.metadata.get("payment_mode")!="live" or intent.metadata.get("gateway_binding")!=intent.gateway.config
            or intent.gateway.test_mode or intent.gateway.code!="paystack"):
        raise SettlementRefused("Signed event does not match independent verification.")
    return event

def _mark_event(event):
    if event and not event.is_processed:
        event.is_processed=True
        event.error_message=""
        event.processed_at=timezone.now()
        event.save(update_fields=["is_processed","error_message","processed_at"])

def settle_verified_intent(intent_id, *, getter=None, signed_event_id=None):
    if not getattr(settings, "CLOUD_SETTLEMENT_COMMIT_ENABLED", False):
        raise SettlementRefused("Gateway settlement commit is disabled.")
    try:
        intent = PaymentIntent.objects.select_related("gateway", "invoice__order").get(pk=intent_id)
    except (PaymentIntent.DoesNotExist, ValueError, TypeError):
        raise SettlementRefused("Payment intent not found.") from None

    # Idempotent duplicates are read-only and DO NOT query the gateway or
    # create a second transaction. A complete financial ledger is required.
    if intent.status == "completed":
        with db_transaction.atomic():
            seen = PaymentIntent.objects.select_for_update().get(pk=intent.pk)
            paid_invoice = Invoice.objects.select_for_update().get(pk=seen.invoice_id)
            prior = Transaction.objects.select_for_update().filter(reference=seen.reference).first()
            paid_order = Order.objects.select_for_update().filter(pk=paid_invoice.order_id).first()
            proof = prior.metadata if prior and isinstance(prior.metadata, dict) else {}
            if (seen.status == "completed" and paid_invoice.status == "paid"
                    and paid_order is not None and paid_order.status in ("paid", "provisioned")
                    and prior is not None and prior.status == "successful"
                    and prior.gateway_id == seen.gateway_id
                    and prior.invoice_id == paid_invoice.pk
                    and prior.client_id == seen.client_id
                    and prior.currency == seen.currency and prior.amount == seen.amount
                    and paid_invoice.amount_due == Decimal("0")
                    and paid_invoice.amount_paid == paid_invoice.total
                    and proof.get("verification_source") == "provider_api_verified"
                    and proof.get("provider_api_verified") is True
                    and proof.get("verified_remote_id") == prior.provider_reference
                    and prior.provider_reference):
                _mark_event(_signed_event(signed_event_id,seen,prior.provider_reference))
                return prior, False
            raise SettlementRefused("Completed payment has inconsistent financial authority.")

    # The only remotely trusted financial fact is a fresh, independent API
    # verification of the exact previously issued reference.
    verified = verify_gateway_intent(intent, getter=getter)

    with db_transaction.atomic():
        locked = PaymentIntent.objects.select_for_update().select_related("gateway").get(pk=intent.pk)
        invoice = Invoice.objects.select_for_update().get(pk=locked.invoice_id)
        current_gateway=PaymentGateway.objects.select_for_update().get(pk=locked.gateway_id)
        if current_gateway.config!=intent.gateway.config or current_gateway.status!=intent.gateway.status or current_gateway.test_mode!=intent.gateway.test_mode:
            raise SettlementRefused("Gateway authority changed.")
        locked.gateway=current_gateway
        if signed_event_id is not None:
            from .live_binding import resolve_live_key
            if not resolve_live_key(current_gateway):
                raise SettlementRefused("Live gateway authority changed.")
        event=_signed_event(signed_event_id,locked,verified.remote_id)
        if not invoice.order_id:
            raise SettlementRefused("Invoice has no linked order.")
        order = Order.objects.select_for_update().get(pk=invoice.order_id)

        # An already-settled intent may be observed more than once, but
        # MUST agree with the original reference, gateway and amount.
        existing = Transaction.objects.select_for_update().filter(reference=locked.reference).first()
        if existing:
            if (locked.status == "completed" and invoice.status == "paid" and
                    order.status in ("paid", "provisioned") and existing.status == "successful" and
                    existing.invoice_id == invoice.pk and
                    existing.gateway_id == locked.gateway_id and
                    existing.client_id == locked.client_id and
                    existing.provider_reference == verified.remote_id and
                    existing.currency == verified.currency and
                    existing.amount == verified.amount):
                _mark_event(event)
                return existing, False
            raise SettlementRefused("Conflicting payment reference; manual review required.")

        if (locked.status not in ("pending", "processing") or locked.is_expired()
                or invoice.status != "unpaid" or order.status != "pending_payment"
                or invoice.client_id != locked.client_id
                or order.client_id != locked.client_id
                or invoice.currency != locked.currency or order.currency != locked.currency
                or locked.gateway.status != "active" or locked.gateway.test_mode
                or verified.reference != locked.reference or verified.gateway != locked.gateway.code
                or verified.currency != locked.currency
                or verified.amount != locked.amount or verified.amount != invoice.total
                or invoice.amount_paid != Decimal("0.00") or order.total != invoice.total
                or Transaction.objects.filter(invoice_id=invoice.pk, status="successful").exists()):
            raise SettlementRefused("Financial records changed or payment is not eligible.")

        # Another invoice or intent must never claim an already settled
        # provider transaction ID, even with a distinct merchant reference.
        if Transaction.objects.filter(
            gateway_id=locked.gateway_id,
            provider_reference=verified.remote_id,
            status="successful",
        ).exists():
            raise SettlementRefused("Gateway transaction has already been settled.")

        now = timezone.now()
        saved = Transaction.objects.create(
            client_id=locked.client_id, invoice=invoice, gateway=locked.gateway,
            reference=locked.reference, provider_reference=verified.remote_id,
            transaction_type="payment", status="successful",
            currency=verified.currency, amount=verified.amount, fee=Decimal("0"),
            net_amount=verified.amount,
            webhook_verified=event is not None,
            metadata={"verification_source": "provider_api_verified",
                      "provider_api_verified": True,
                      "verified_remote_id": verified.remote_id, **({"signed_event_id":event.pk,"payment_mode":"live"} if event else {})},
            paid_at=now,
        )
        invoice.status = "paid"
        invoice.amount_paid = verified.amount
        invoice.amount_due = Decimal("0")
        invoice.paid_at = now
        invoice.save(update_fields=["status", "amount_paid", "amount_due", "paid_at", "updated_at"])
        order.status = "paid"
        order.paid_at = now
        order.save(update_fields=["status", "paid_at", "updated_at"])
        locked.status = "completed"
        locked.save(update_fields=["status"])
        _mark_event(event)
        from settings_registry.mail_authority import queue_payment_confirmed
        queue_payment_confirmed(invoice, saved)
        # The committed financial ledger, not the browser or supplier, is the
        # durable source of hosting work. Failure leaves the payment intact.
        from provisioning.automatic_staging import enabled, stage_order_after_payment
        if order.metadata.get("live_domain_registration_v1") or order.metadata.get("registrar_renewal_v1"):
            from services.commercial_scheduler import wake
            wake("payments")
        elif order.source=="renewal":
            from services.renewals import apply
            db_transaction.on_commit(lambda invoice_id=invoice.pk: apply(invoice_id),robust=True)
        elif enabled():
            db_transaction.on_commit(lambda order_id=order.pk: stage_order_after_payment(order_id))
        return saved, True
