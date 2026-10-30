"""BIZ-02: bounded, read-only business intelligence over canonical records.

These are observations, not a bank reconciliation or accounting profit ledger.
Never join payments to invoice items (which would multiply monetary values).
Only audited, webhook-verified successful payment receipts count as verified
payment records; invoice status alone is NOT settlement evidence.
"""
import re
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Count, Sum, F
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from billing.models import Invoice
from domains.models import Domain
from payments.models import Transaction
from providers.models import Provider
from services.models import Service
from .permissions import IsConsoleFinancialAdmin


ZERO = Decimal("0.00")


def money(value):
    """Use decimal strings: no JS floating point rounding of accounting figures."""
    return str((value if value is not None else ZERO).quantize(Decimal("0.01")))


def aggregate_amount(qs, field="amount"):
    return qs.aggregate(value=Sum(field))["value"] or ZERO


def previous_month_start(start):
    return (start - timedelta(days=1)).replace(day=1)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsConsoleFinancialAdmin])
def business_snapshot(request):
    """Single BFF GET for 5 evidence-backed sections; report library stays separate.

    Never use Redis/CDN shared response caching. Permission is checked for
    every request by Django, irrespective of frontend in-memory state.
    """
    currency = request.query_params.get("currency", "NGN").strip().upper()
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise ValidationError({"currency": "Use a three-letter ISO currency code."})

    now = timezone.now()
    this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month = previous_month_start(this_month)
    year_start = this_month.replace(month=1, day=1)
    year_ago = this_month.replace(year=this_month.year - 1)
    next_week = now + timedelta(days=7)
    next_month = now + timedelta(days=30)

    invoices = Invoice.objects.filter(currency=currency)
    payment_receipts = Transaction.objects.filter(
        currency=currency, status="successful", transaction_type="payment",
        webhook_verified=True, paid_at__isnull=False,
    )
    refund_receipts = Transaction.objects.filter(
        currency=currency, status="successful", transaction_type="refund",
        webhook_verified=True, paid_at__isnull=False,
    )
    current_payments = payment_receipts.filter(paid_at__gte=this_month)
    last_payments = payment_receipts.filter(
        paid_at__gte=last_month, paid_at__lt=this_month)
    annual_payments = payment_receipts.filter(paid_at__gte=year_start)
    paid_invoices = invoices.filter(status="paid", paid_at__isnull=False)
    active_services = Service.objects.filter(status="active")
    upcoming_services = active_services.filter(
        next_due_date__gte=now, next_due_date__lte=next_month)
    users = get_user_model().objects.filter(is_staff=False, is_superuser=False)
    current_users = users.filter(date_joined__gte=this_month)
    previous_users = users.filter(
        date_joined__gte=last_month, date_joined__lt=this_month)

    invoice_status = {
        status: count for status, count in
        invoices.values_list("status").annotate(count=Count("pk"))
    }
    registration = list(
        users.filter(date_joined__gte=year_ago)
        .annotate(month=TruncMonth("date_joined"))
        .values("month").annotate(count=Count("id")).order_by("month")
    )
    payment_months = list(
        payment_receipts.filter(paid_at__gte=year_ago)
        .annotate(month=TruncMonth("paid_at"))
        .values("month").annotate(count=Count("id"), amount=Sum("amount"))
        .order_by("month")
    )

    provider_counts = list(
        active_services.exclude(provider_id__isnull=True)
        .values("provider_id").annotate(count=Count("id"))
        .order_by("-count", "provider_id")[:12]
    )
    provider_names = {
        row["id"]: row["name"]
        for row in Provider.objects.filter(
            id__in=[entry["provider_id"] for entry in provider_counts]
        ).values("id", "name")
    }

    paid_current = paid_invoices.filter(paid_at__gte=this_month)
    renewal_paid = paid_invoices.filter(
        metadata__type="renewal", paid_at__gte=this_month)
    totals = {
        "this_month": money(aggregate_amount(current_payments)),
        "last_month": money(aggregate_amount(last_payments)),
        "year_to_date": money(aggregate_amount(annual_payments)),
        "refunded_this_month": money(aggregate_amount(
            refund_receipts.filter(paid_at__gte=this_month))),
    }
    return Response({
        "as_of": now.isoformat(),
        "currency": currency,
        "methodology": {
            "payment_basis": "successful payment transactions with verified webhooks",
            "settlement_verified": False,
            "profit_verified": False,
            "provider_cost_evidence": "unavailable",
            "invoice_status_is_settlement": False,
            "currency_policy": "one currency at a time; no implicit FX",
        },
        "overview": {
            "payment_amounts": totals,
            "verified_payment_count_this_month": current_payments.count(),
            "paid_invoices_this_month": paid_current.count(),
            "pending_invoices": invoices.filter(
                status__in=("unpaid", "partially_paid", "overdue")).count(),
            "active_services": active_services.count(),
            "new_customers_this_month": current_users.count(),
            "paid_renewal_invoices_this_month": renewal_paid.count(),
        },
        "finance": {
            "payment_amounts": totals,
            "invoice_status": invoice_status,
            "paid_before_due_this_month": paid_current.filter(
                paid_at__lte=F("due_date")
            ).count(),
            "paid_after_due_this_month": paid_current.filter(
                paid_at__gt=F("due_date")
            ).count(),
            "payment_months": [
                {"month": row["month"].date().isoformat()[:7],
                 "count": row["count"], "amount": money(row["amount"])}
                for row in payment_months
            ],
        },
        "customers": {
            "registered_total": users.count(),
            "registered_this_month": current_users.count(),
            "registered_last_month": previous_users.count(),
            "paying_customers_this_month": current_payments.values(
                "client_id").distinct().count(),
            "registrations_by_month": [
                {"month": row["month"].date().isoformat()[:7], "count": row["count"]}
                for row in registration
            ],
        },
        "renewals": {
            "services_due_in_7_days": active_services.filter(
                next_due_date__gte=now, next_due_date__lte=next_week).count(),
            "services_due_in_30_days": upcoming_services.count(),
            "services_past_due": active_services.filter(
                next_due_date__lt=now).count(),
            "domains_expiring_in_30_days": Domain.objects.filter(
                status="active", expiry_date__gte=now, expiry_date__lte=next_month
            ).count(),
            "paid_renewal_invoices_this_month": renewal_paid.count(),
        },
        "providers": {
            "active_services_with_provider": active_services.exclude(provider_id__isnull=True).count(),
            "distribution": [
                {"id": str(row["provider_id"]),
                 "name": provider_names.get(row["provider_id"], "Provider not found"),
                 "active_services": row["count"]}
                for row in provider_counts
            ],
            "margin": None,
            "supplier_cost": None,
            "note": "Supplier cost and settled-profit evidence are not qualified; no margin is calculated.",
        },
    }, headers={"Cache-Control": "private, no-store", "Vary": "Cookie, Authorization"})
