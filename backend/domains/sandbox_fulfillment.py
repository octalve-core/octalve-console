"""Bounded, operator-scoped sandbox registrar automation.

Only a single explicitly pinned private test order is eligible. Public payment
tests, commercial orders, unprocessed historical evidence and real entitlements
are outside this worker. No network calls occur while a DB lock is held.
"""
import os
from uuid import UUID

from django.db import DatabaseError, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.exceptions import ValidationError

from billing.models import Invoice
from orders.models import Order, OrderItem
from payments.domain_pilot_scope import CART, PILOT, pilot_gateway_allowed
from payments.hosted_checkout import CheckoutRefused, payment_history
from payments.models import Transaction, WebhookEvent
from providers.cloudflare_int01 import CloudflareINT01Denied, require_domain
from providers.connection_models import IntegrationCredentialVersion
from providers.connection_vault import VaultUnavailable
from .models import TLDPricing

def approved_order_id():
    if os.getenv("CLOUD_REGISTRAR_SANDBOX_AUTOMATION_ENABLED") != "true":
        return None
    raw = os.getenv("CLOUD_REGISTRAR_SANDBOX_ORDER_ID", "")
    try:
        identifier = UUID(raw)
    except (ValueError, TypeError, AttributeError):
        return None
    return identifier if identifier.version == 4 and str(identifier) == raw else None

def automation_status():
    return {"mode": "operator_scoped_sandbox", "configured": approved_order_id() is not None,
            "public_payment_only": True, "live_execution_enabled": False}

def assert_private_domain_unclaimed(names, *, order_id=None):
    """Serialize private claims on existing TLD rows, not on the network.
    
    A previous private order remains a claim even after an uncertain response
    or rejection. Public payment-only fixtures are never supplier claims.
    This conservative hold requires manual review rather than automatic reuse.
    """
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("Sandbox claims require a database transaction")
    names = sorted(set(require_domain(name) for name in names))
    if not names:
        raise ValidationError("A sandbox domain is required.")
    tlds = sorted({"." + name.rsplit(".", 1)[1] for name in names})
    locked = list(TLDPricing.objects.select_for_update().filter(tld__in=tlds).order_by("tld").values_list("tld", flat=True))
    if locked != tlds:
        raise ValidationError("Sandbox domain pricing is unavailable.")
    prior = OrderItem.objects.filter(item_type="domain", domain_name__in=names)
    if order_id is not None:
        prior = prior.exclude(order_id=order_id)
    private = (Q(order__metadata__has_key=PILOT) &
               (Q(order__metadata__sandbox_domain_purchase__public_payment_test=False) |
                Q(order__metadata__sandbox_domain_purchase__public_payment_test__isnull=True))) | (
               Q(order__metadata__has_key=CART) &
               (Q(order__metadata__combined_domain_test_cart__public_payment_test=False) |
                Q(order__metadata__combined_domain_test_cart__public_payment_test__isnull=True)))
    if prior.filter(private).exists():
        raise ValidationError("A private sandbox order already holds this domain. Review its original invoice.")

def _private_context(order):
    if not isinstance(order.metadata, dict):
        return None
    keys = [key for key in (PILOT, CART) if key in order.metadata]
    if len(keys) != 1:
        return None
    key = keys[0]
    state = order.metadata[key]
    if not isinstance(state, dict) or (state.get("public_payment_test") is not None and state.get("public_payment_test") is not False):
        return None
    # Refund rehearsal is a hold, never supplier authority.
    rehearsal = order.metadata.get("test_lifecycle_v1", {})
    refund = rehearsal.get("refund", {}) if isinstance(rehearsal, dict) else None
    if not isinstance(refund, dict) or refund.get("status", "not_requested") != "not_requested":
        return None
    return key, state

def _payment_context(order, key, state):
    invoices = list(Invoice.objects.filter(order=order).select_related("order", "client")[:2])
    if len(invoices) != 1:
        return None
    invoice = invoices[0]
    if (invoice.metadata.get(key) is not True or invoice.client_id != order.client_id
            or invoice.currency != order.currency or invoice.total != order.total
            or invoice.amount_paid != 0 or Transaction.objects.filter(invoice=invoice).exists()):
        return None
    intent, _ = payment_history(invoice)
    if not intent or not pilot_gateway_allowed(intent.gateway, invoice):
        return None
    return invoice, intent

def _processed_evidence(invoice, intent, state):
    if invoice.status != "void" or intent.status != "completed":
        return False
    remote = state.get("payment_remote_id")
    verified = parse_datetime(state.get("payment_verified_at") or "")
    if (not isinstance(remote, str) or not remote.isascii() or not remote.isdecimal()
            or not verified or timezone.is_naive(verified) or verified > timezone.now()
            or state.get("payment_reference") != intent.reference):
        return False
    events = list(WebhookEvent.objects.filter(
        gateway_id=intent.gateway_id, is_verified=True, event_type="charge.success",
        payload__intent_id=intent.pk, payload__reference=intent.reference,
        payload__remote_id=remote)[:2])
    if len(events) != 1 or not events[0].is_processed or events[0].processed_at is None:
        return False
    from audit.models import AuditLog
    return not AuditLog.objects.filter(entity_type="HistoricalTestPayment", entity_id=str(events[0].pk),
                                      details__fulfillment_authorized=False).exists()

def advance_approved_order():
    """One bounded operation per run, never retry an ambiguous supplier POST."""
    identifier = approved_order_id()
    if identifier is None:
        return "disabled"
    order = Order.objects.filter(public_id=identifier).first()
    if order is None:
        return "held"
    context = _private_context(order)
    if not context:
        return "held"
    key, state = context
    try:
        evidence = _payment_context(order, key, state)
        if not evidence:
            return "held"
        invoice, intent = evidence
        if order.status == "pending_payment" and invoice.status == "unpaid":
            # Pending private checkout is advanced only from a signed inbox.
            if intent.status not in ("pending", "processing") or not WebhookEvent.objects.filter(
                    gateway_id=intent.gateway_id, is_verified=True, is_processed=False,
                    event_type="charge.success", payload__intent_id=intent.pk,
                    payload__reference=intent.reference).exists():
                return "waiting_payment"
            if key == CART:
                from .combined_cart import confirm_payment
                confirm_payment(order)
            elif state.get("state") == "awaiting_payment":
                from .pilot import reconcile
                reconcile(order)
            else:
                return "held"
            return "advanced"
        if order.status != "needs_review" or not _processed_evidence(invoice, intent, state):
            return "held"
        if key == PILOT:
            if state.get("state") not in ("registration_uncertain", "registration_pending"):
                return "idle"
            # Historic recovery is never an automatic new submission.
            if state.get("sandbox_submission_reserved") is not True:
                return "held"
            from .pilot import registrar, reconcile_registration
            supplier, _ = registrar(state)
            reconcile_registration(order, supplier)
        else:
            line = order.items.filter(item_type="domain", config__combined_domain_test_cart__state__in=(
                "awaiting_payment", "registration_uncertain", "registration_pending")).order_by("pk").first()
            if not line:
                return "idle"
            if (line.domain_name not in state.get("domains", [])
                    or line.config[CART].get("domain") != line.domain_name):
                return "held"
            from .combined_cart import reconcile_line
            reconcile_line(order, line.pk)
        return "advanced"
    except (CheckoutRefused, CloudflareINT01Denied, VaultUnavailable, IntegrationCredentialVersion.DoesNotExist,
            DatabaseError, ValidationError, KeyError, TypeError, ValueError):
        return "held"
