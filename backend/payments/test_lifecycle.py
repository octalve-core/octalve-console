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
from payments.hosted_checkout import payment_history, CheckoutRefused

KEY = "test_lifecycle_v1"


def enabled():
    return (getattr(settings, "CLOUD_TEST_LIFECYCLE_ENABLED", False) is True
            and getattr(settings, "CLOUD_PUBLIC_DOMAIN_PAYMENT_TEST_ENABLED", False) is True)


def marker(invoice, order, *, rehearsal=False):
    if not enabled() or invoice.order_id != order.pk or invoice.client_id != order.client_id:
        return None
    for key in (CART, PILOT):
        state = order.metadata.get(key)
        if invoice.metadata.get(key) is True and isinstance(state, dict) and (state.get("public_payment_test") is True or rehearsal):
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


def record_confirmed_test(invoice, payment, order, proof, verified_at, *, rehearsal=False):
    """Within verified test settlement transaction, create one isolated ledger."""
    key = marker(invoice, order, rehearsal=rehearsal)
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
    order.metadata[KEY] = {"mode": "simulation", "rehearsal_only": rehearsal,
        "payment": {"status": "verified_test", "reference": proof.reference,
                    "remote_id": proof.remote_id, "amount": str(proof.amount),
                    "currency": proof.currency, "verified_at": verified_at.isoformat()},
        "items": rows,
        "welcome": {"reference": _identity(order, 0, "welcome"), "status": "simulated_queued",
                    "subject": "[TEST] Your Octalve Cloud order is ready for review",
                    "body": "Sandbox lifecycle completed. No domain, hosting account or credentials were issued. Review your order in the signed-in Console."},
        "renewals": [], "refund": {"status": "not_requested"},
        "next_due_at": min(row["next_due"] for row in rows)}


def _locked_verified(invoice_id):
    invoice = Invoice.objects.select_for_update().get(pk=invoice_id)
    if not invoice.order_id:
        raise ValidationError("Test invoice not found.")
    intents = list(invoice.payment_intents.select_for_update().filter(status="completed")[:2])
    order = Order.objects.select_for_update().get(pk=invoice.order_id)
    value = safe_snapshot(order)
    key = marker(invoice, order, rehearsal=bool(order.metadata.get(KEY,{}).get("rehearsal_only")))
    if not key or not value or len(intents) != 1 or invoice.status != "void" or order.status != "needs_review":
        raise ValidationError("Verified test lifecycle is unavailable.")
    intent = intents[0]
    active, _ = payment_history(invoice, lock=True)
    if not active or active.pk != intent.pk:
        raise ValidationError("Test payment history requires review.")
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
        remaining=[i["next_due"] for i in value["items"] if i["reference"] not in {r["service_reference"] for r in value["renewals"]}]
        value["next_due_at"]=min(remaining) if remaining else None
        value["rehearsal_only"]=order.metadata[KEY].get("rehearsal_only") is True
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
    value["next_due_at"]=None
    value["rehearsal_only"]=order.metadata[KEY].get("rehearsal_only") is True
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

@transaction.atomic
def rehearse_verified_test(invoice_id):
    """Explicit Super Admin rehearsal on already processed evidence only.

    No historical repair, payment, supplier submission, or fabricated proof.
    The prior independently verified identity and its processed inbox must
    already agree; unprocessed historical events are never accepted here.
    """
    from payments.readback import ConfirmedGatewayPayment
    invoice=Invoice.objects.select_for_update().get(pk=invoice_id)
    if not invoice.order_id:
        raise ValidationError("Test invoice is unavailable.")
    intent, _ = payment_history(invoice,lock=True)
    order=Order.objects.select_for_update().get(pk=invoice.order_id)
    key=marker(invoice,order,rehearsal=True)
    if (not key or not intent or intent.status!="completed" or invoice.status!="void"
            or order.status!="needs_review" or not pilot_gateway_allowed(intent.gateway,invoice)):
        raise ValidationError("Only a previously verified test invoice may be rehearsed.")
    if safe_snapshot(order):
        _,_,value=_locked_verified(invoice.pk)
        return value
    prior=order.metadata[key]
    remote=prior.get("payment_remote_id")
    verified=parse_datetime(prior.get("payment_verified_at") or "")
    if (not isinstance(remote,str) or not remote.isascii() or not remote.isdecimal()
            or not verified or timezone.is_naive(verified) or verified>timezone.now()
            or prior.get("payment_reference")!=intent.reference):
        raise ValidationError("Stored independent verification evidence is incomplete.")
    events=list(WebhookEvent.objects.select_for_update().filter(
        gateway_id=intent.gateway_id,is_verified=True,is_processed=True,
        event_type="charge.success",payload__intent_id=intent.pk,
        payload__reference=intent.reference,payload__remote_id=remote)[:2])
    if len(events)!=1 or not events[0].processed_at:
        raise ValidationError("A matching processed signed notification is required.")
    proof=ConfirmedGatewayPayment("paystack",intent.reference,intent.currency,intent.amount,remote)
    record_confirmed_test(invoice,intent,order,proof,verified,rehearsal=True)
    order.save(update_fields=["metadata","updated_at"])
    return safe_snapshot(order)



def review_historical_events():
    """Metadata-only audit. Never invent missing provider evidence or repair rows."""
    rows = WebhookEvent.objects.filter(is_verified=True, is_processed=False,
        event_type="charge.success", gateway__code="paystack", gateway__test_mode=True).order_by("pk")[:100]
    results = []
    for event in rows:
        data = event.payload if isinstance(event.payload, dict) else {}
        intent = PaymentIntent.objects.select_related("invoice__order", "gateway").filter(
            pk=data.get("intent_id") if type(data.get("intent_id")) is int else None,
            gateway_id=event.gateway_id, reference=data.get("reference")).first()
        if not intent or not intent.invoice.order_id:
            results.append({"event":event.pk, "classification":"unmatched_reference"})
            continue
        invoice, order = intent.invoice, intent.invoice.order
        snapshot = next((order.metadata.get(k) for k in (CART,PILOT) if invoice.metadata.get(k) is True), None)
        classification = "pending_verification"
        if intent.status == "completed":
            if (invoice.status != "void" or order.status != "needs_review" or
                    intent.client_id != invoice.client_id or order.client_id != invoice.client_id or
                    intent.amount != invoice.total or order.total != invoice.total or
                    invoice.currency != intent.currency or not isinstance(snapshot,dict) or
                    snapshot.get("payment_reference") != intent.reference):
                classification = "conflicting_history"
            elif not snapshot.get("payment_remote_id"):
                classification = "missing_stored_remote_identity"
            elif snapshot["payment_remote_id"] == data.get("remote_id"):
                classification = "matching_stored_evidence_requires_audit"
            else:
                classification = "conflicting_remote_identity"
        results.append({"event":event.pk,"invoice_reference":invoice.public_reference,
                        "order_reference":order.public_reference,"classification":classification})
    return results


def run_due_work():
    """Bounded recurring work. No live settlement or supplier/mail transport."""
    if not enabled():
        return {"disabled":True}
    from django.db import DatabaseError
    from django.db.models import Q
    from payments.readback import PaymentReadbackRejected
    counters = {"processed":0,"held":0,"renewals":0}
    # Filter to currently payable, public test invoices first; historical
    # evidence cannot starve pending inbox rows.
    intents = PaymentIntent.objects.filter(status__in=("pending","processing"),
        gateway__code="paystack",gateway__test_mode=True,gateway__status="test",
        invoice__status="unpaid").filter(
        Q(invoice__metadata__combined_domain_test_cart=True,
          invoice__order__metadata__combined_domain_test_cart__public_payment_test=True) |
        Q(invoice__metadata__sandbox_domain_purchase=True,
          invoice__order__metadata__sandbox_domain_purchase__public_payment_test=True))
    ids = list(intents.order_by("pk").values_list("pk",flat=True)[:100])
    events = WebhookEvent.objects.filter(is_verified=True,is_processed=False,
        event_type="charge.success",gateway__code="paystack",gateway__test_mode=True,
        payload__intent_id__in=ids).order_by("pk")[:2]
    for event in events:
        try:
            result = consume_public_event(event.pk)
            counters["processed" if result=="processed" else "held"] += 1
        except (ValidationError, DatabaseError, CheckoutRefused, PaymentReadbackRejected):
            counters["held"] += 1
    # Mark work as complete for each simulated cycle; no repeating invoices.
    now=timezone.now()
    candidates = Invoice.objects.filter(status="void",order__metadata__test_lifecycle_v1__refund__status="not_requested",
        order__metadata__test_lifecycle_v1__next_due_at__lte=now.isoformat(),
        order__metadata__test_lifecycle_v1__next_due_at__isnull=False).exclude(order__metadata__test_lifecycle_v1__next_due_at=None).select_related("order").order_by("pk")[:40]
    count=0
    for invoice in candidates.iterator(chunk_size=100):
        value=safe_snapshot(invoice.order)
        if not value or value.get("refund",{}).get("status")!="not_requested":
            continue
        existing={r["service_reference"] for r in value["renewals"]}
        if not any(item["reference"] not in existing and parse_datetime(item["next_due"]) <= now for item in value["items"]):
            continue
        if count>=20:
            break
        count+=1
        try:
            counters["renewals"] += int(advance_renewals(invoice.pk,at=now))
        except (ValidationError, DatabaseError, CheckoutRefused):
            counters["held"] += 1
    return counters
