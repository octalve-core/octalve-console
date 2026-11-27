"""Sandbox-only lifecycle; never a live transaction, provider, mail or service authority.

The existing signed event consumer and independent readback remain the sole
payment authority. Simulation snapshots reside only on marked test orders.
All mutations serialize on invoice -> intent -> order; no external writes.
"""
from decimal import Decimal
from uuid import uuid5, NAMESPACE_URL

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ValidationError

from billing.models import Invoice
from orders.models import Order
from payments.domain_pilot_scope import CART, PILOT, pilot_gateway_allowed
from payments.models import PaymentIntent, WebhookEvent, Transaction

KEY = "test_lifecycle_v1"


def enabled():
    return (getattr(settings, "CLOUD_TEST_LIFECYCLE_ENABLED", False) is True
            and getattr(settings, "CLOUD_PUBLIC_DOMAIN_PAYMENT_TEST_ENABLED", False) is True)


def marker(invoice, order):
    if not enabled() or invoice.order_id != order.pk or invoice.client_id != order.client_id:
        return None
    for key in (CART, PILOT):
        state = order.metadata.get(key)
        if invoice.metadata.get(key) is True and isinstance(state, dict) and state.get("public_payment_test") is True:
            return key
    return None


def safe_snapshot(order):
    value = order.metadata.get(KEY) if isinstance(order.metadata, dict) else None
    if not isinstance(value, dict) or value.get("mode") != "simulation":
        return None
    # Values are created solely by this module, not by checkout form data.
    return {k: value[k] for k in ("mode", "payment", "items", "welcome", "renewals", "refund") if k in value}


def _identity(order, item, kind):
    return "TEST-" + str(uuid5(NAMESPACE_URL, f"octalve:{order.public_id}:{item}:{kind}")).upper()


def record_confirmed_test(invoice, payment, order, proof, verified_at):
    """Within verified test settlement transaction, create one isolated ledger."""
    key = marker(invoice, order)
    if key is None:
        return
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("Test lifecycle requires an atomic transaction")
    if (not pilot_gateway_allowed(payment.gateway, invoice) or payment.invoice_id != invoice.pk
            or payment.client_id != invoice.client_id or payment.reference != proof.reference
            or payment.amount != invoice.total or payment.amount != proof.amount
            or order.total != invoice.total or proof.currency != invoice.currency
            or proof.gateway != "paystack" or invoice.amount_paid != Decimal("0")
            or Transaction.objects.filter(invoice=invoice).exists()):
        raise ValidationError("Test lifecycle financial evidence is inconsistent.")
    prior = order.metadata.get(KEY)
    if prior:
        if prior.get("payment", {}).get("reference") != proof.reference:
            raise ValidationError("Conflicting sandbox settlement reference.")
        return
    items = list(order.items.order_by("pk")[:21])
    if (not 1 <= len(items) <= 20 or sum((i.subtotal for i in items), Decimal("0")) != invoice.total
            or any(i.item_type not in ("domain", "hosting", "vps") or not 1 <= i.months <= 120 for i in items)):
        raise ValidationError("Test fulfillment items do not match the verified invoice.")
    rows = []
    for item in items:
        due = verified_at + relativedelta(months=item.months)
        rows.append({"reference": _identity(order, item.pk, "service"), "name": item.description,
                     "type": item.item_type, "status": "simulated_active",
                     "supplier_status": "simulated_success", "activated_at": verified_at.isoformat(),
                     "next_due": due.isoformat(), "months": item.months,
                     "amount": str(item.subtotal), "currency": invoice.currency,
                     "access": "simulation_only"})
    order.metadata[KEY] = {"mode": "simulation",
        "payment": {"status": "verified_test", "reference": proof.reference,
                    "remote_id": proof.remote_id, "amount": str(proof.amount),
                    "currency": proof.currency, "verified_at": verified_at.isoformat()},
        "items": rows,
        "welcome": {"reference": _identity(order, 0, "welcome"), "status": "simulated_queued",
                    "subject": "[TEST] Your Octalve Cloud order is ready for review",
                    "body": "Sandbox lifecycle completed. No domain, hosting account or credentials were issued. Review your order in the signed-in Console."},
        "renewals": [], "refund": {"status": "not_requested"}}


def _locked_verified(invoice_id):
    invoice = Invoice.objects.select_for_update().get(pk=invoice_id)
    if not invoice.order_id:
        raise ValidationError("Test invoice not found.")
    intents = list(invoice.payment_intents.select_for_update().filter(status="completed")[:2])
    order = Order.objects.select_for_update().get(pk=invoice.order_id)
    key = marker(invoice, order)
    value = safe_snapshot(order)
    if not key or not value or len(intents) != 1 or invoice.status != "void" or order.status != "needs_review":
        raise ValidationError("Verified test lifecycle is unavailable.")
    intent = intents[0]
    evidence = value["payment"]
    if (not pilot_gateway_allowed(intent.gateway, invoice) or intent.client_id != invoice.client_id
            or intent.reference != evidence["reference"] or intent.amount != invoice.total
            or intent.currency != invoice.currency or order.total != invoice.total
            or invoice.amount_paid != 0 or Transaction.objects.filter(invoice=invoice).exists()
            or not WebhookEvent.objects.filter(gateway=intent.gateway, is_verified=True, is_processed=True,
                event_type="charge.success", payload__intent_id=intent.pk, payload__reference=intent.reference,
                payload__remote_id=evidence["remote_id"]).exists()):
        raise ValidationError("Test lifecycle evidence changed.")
    return invoice, order, value


@transaction.atomic
def advance_renewals(invoice_id, *, at=None):
    """Produce at most one simulated renewal bill per original item/period.

    No payable invoice, real service date, charge, or current price is changed.
    The original paid test amount is explicitly a fixture, not a renewal quote.
    """
    invoice, order, value = _locked_verified(invoice_id)
    if value["refund"]["status"] != "not_requested":
        return False
    now = at or timezone.now()
    changed = False
    existing = {r["service_reference"] for r in value["renewals"]}
    for item in value["items"]:
        due = parse_datetime(item["next_due"])
        if due and now >= due and item["reference"] not in existing:
            value["renewals"].append({"reference": _identity(order, item["reference"], "renewal"),
                "service_reference": item["reference"], "name": item["name"],
                "status": "simulated_invoice_issued", "due_at": due.isoformat(),
                "period_end": (due + relativedelta(months=item["months"])).isoformat(),
                "amount": item["amount"], "currency": invoice.currency, "pricing": "original_test_amount"})
            changed = True
    if changed:
        order.metadata[KEY] = value
        order.save(update_fields=["metadata", "updated_at"])
    return changed


@transaction.atomic
def simulate_refund(invoice_id):
    """Explicit sandbox exercise, not a Paystack refund or financial reversal."""
    invoice, order, value = _locked_verified(invoice_id)
    if value["refund"]["status"] == "simulated_refund":
        return value
    value["refund"] = {"status": "simulated_refund", "reference": _identity(order, 0, "refund"),
                       "amount": str(invoice.total), "currency": invoice.currency}
    for item in value["items"]:
        item["status"] = "simulated_cancelled"
    order.metadata[KEY] = value
    order.save(update_fields=["metadata", "updated_at"])
    return value


def consume_public_event(event_id):
    """Signed inbox row -> independent verification -> test settlement.

    No historic pilot registrar may execute from this worker. A retry is safe:
    the existing confirmation locks and consumes the inbox row exactly once.
    """
    if not enabled():
        return "disabled"
    event = WebhookEvent.objects.filter(pk=event_id, is_verified=True, event_type="charge.success",
                                       gateway__code="paystack", gateway__test_mode=True, gateway__status="test").first()
    if not event:
        return "ignored"
    if event.is_processed:
        return "processed"
    data = event.payload
    if not isinstance(data, dict) or type(data.get("intent_id")) is not int:
        return "ignored"
    intent = PaymentIntent.objects.select_related("invoice__order", "invoice__client", "gateway").filter(
        pk=data["intent_id"], reference=data.get("reference"), gateway_id=event.gateway_id).first()
    if not intent or not intent.invoice.order_id or not marker(intent.invoice, intent.invoice.order):
        return "ignored"
    if intent.status not in ("pending", "processing") or intent.invoice.status != "unpaid":
        return "historical_review"
    if not pilot_gateway_allowed(intent.gateway, intent.invoice):
        return "ignored"
    if intent.invoice.metadata.get(CART) is True:
        from domains.combined_cart import confirm_payment
        confirm_payment(intent.invoice.order)
    else:
        from domains.pilot import reconcile
        reconcile(intent.invoice.order)
    return "processed" if WebhookEvent.objects.filter(pk=event.pk, is_processed=True).exists() else "pending"
