"""Super Admin TLD rate-card drafts. No registrar quote, payment or renewal execution.

Reuses the existing TLDPricing.metadata JSON column: no Production migration.
The public legacy TLD pricing endpoint only sees rows marked 'active'; this
writer always leaves edited/new rows 'inactive' until supplier qualification.
"""
import re
from decimal import Decimal
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.response import Response
from catalog.permissions import InternalSupplierAuthority
from providers.connection_stepup import assert_admin, check_mutation
from providers.connection_views import VaultMutationThrottle
from audit.models import AuditLog
from .models import TLDPricing

TERMS = ("1", "2", "5", "10")
TLD_RE = re.compile(r"^\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?){0,2}$")
MONEY_RE = re.compile(r"^(?:0|[1-9][0-9]{0,7})\.[0-9]{2}$")


def _money(value, *, optional=False):
    if value is None and optional:
        return None
    if not isinstance(value, str) or not MONEY_RE.fullmatch(value):
        raise ValidationError({"prices": "Use NGN prices with exactly two decimal places."})
    result = Decimal(value)
    if result <= 0 or result > Decimal("99999999.99"):
        raise ValidationError({"prices": "Prices must be positive and within supported limits."})
    return result


def _matrix(value):
    if not isinstance(value, dict) or set(value) != set(TERMS):
        raise ValidationError({"prices": "Supply exact 1, 2, 5 and 10-year amounts. Use null for unsupported terms."})
    parsed = {term: _money(value[term], optional=term != "1") for term in TERMS}
    prior = Decimal("0.00")
    for term in TERMS:
        amount = parsed[term]
        if amount is not None:
            if amount < prior:
                raise ValidationError({"prices": "A longer term cannot cost less in total than a shorter available term."})
            prior = amount
    return parsed


def _rate_card(row):
    metadata = row.metadata if isinstance(row.metadata, dict) else {}
    saved = metadata.get("period_pricing_v1")
    saved = saved if isinstance(saved, dict) else {}
    def full(operation, yearly):
        raw = saved.get(operation)
        raw = raw if isinstance(raw, dict) else {}
        return {term: str(raw[term]) if isinstance(raw.get(term), str) else
                str(yearly) if term == "1" else None for term in TERMS}
    return {
        "tld": row.tld, "description": row.description or "",
        "currency": "NGN",
        "registration": full("registration", row.register_price),
        "renewal": full("renewal", row.renewal_price),
        "transfer_price": str(row.transfer_price),
        "revision": saved.get("revision", 0) if type(saved.get("revision", 0)) is int else 0,
        "updated_at": row.updated_at.isoformat(),
        "publication": "inactive_draft",
        "registrar_quote_verified": False,
        "checkout_enabled": False,
    }


@api_view(["GET", "POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def admin_tld_price_cards(request):
    """No secrets, no automatic checkout: the merchant's controlled rate drafts."""
    assert_admin(request.user)
    if request.method == "GET":
        rows = list(TLDPricing.objects.order_by("sort_order", "tld")[:301])
        return Response(
            {"results": [_rate_card(row) for row in rows[:300]],
             "truncated": len(rows) > 300, "currency": "NGN",
             "checkout_enabled": False},
            headers={"Cache-Control": "private, no-store"},
        )
    payload = request.data
    expected = {"tld", "description", "registration", "renewal",
                "transfer_price", "expected_revision", "confirm_password", "totp_code"}
    if not isinstance(payload, dict) or set(payload) != expected:
        raise ValidationError({"detail": "Use the exact approved TLD price fields."})
    tld = payload["tld"]
    if not isinstance(tld, str) or len(tld) > 50 or not TLD_RE.fullmatch(tld):
        raise ValidationError({"tld": "Use a lowercase TLD such as .com or .com.ng."})
    description = payload["description"]
    if not isinstance(description, str) or len(description) > 500:
        raise ValidationError({"description": "Description must be at most 500 characters."})
    revision = payload["expected_revision"]
    if type(revision) is not int or revision < 0:
        raise ValidationError({"expected_revision": "A non-negative revision is required."})
    password = payload["confirm_password"]
    if not isinstance(password, str) or not (1 <= len(password) <= 512) or not request.user.check_password(password):
        raise PermissionDenied("Account password could not be verified.")
    # An edited financial rate card requires a fresh, unused vault TOTP.
    # The shared Super Admin authenticator prevents replay of the same code.
    check_mutation(request.user, password, payload["totp_code"])
    registration = _matrix(payload["registration"])
    renewal = _matrix(payload["renewal"])
    transfer = _money(payload["transfer_price"])
    # Keep sensitive financial updates atomic with their audit receipt.
    try:
        with transaction.atomic():
            row = TLDPricing.objects.select_for_update().filter(tld=tld).first()
            if row is None:
                if revision != 0:
                    return Response({"detail": "Price card changed. Refresh before saving."}, status=409)
                row = TLDPricing(tld=tld, register_price=registration["1"],
                    renewal_price=renewal["1"], transfer_price=transfer, status="inactive")
                current = 0
            else:
                saved = row.metadata.get("period_pricing_v1", {}) if isinstance(row.metadata, dict) else {}
                current = saved.get("revision", 0) if isinstance(saved, dict) else 0
                if type(current) is not int or current != revision:
                    return Response({"detail": "Price card changed. Refresh before saving."}, status=409)
            row.description = description
            row.register_price = registration["1"]
            row.renewal_price = renewal["1"]
            row.transfer_price = transfer
            row.status = "inactive"
            metadata = dict(row.metadata) if isinstance(row.metadata, dict) else {}
            metadata["period_pricing_v1"] = {
                "registration": {k: str(v) if v is not None else None for k, v in registration.items()},
                "renewal": {k: str(v) if v is not None else None for k, v in renewal.items()},
                "revision": current + 1, "currency": "NGN",
            }
            row.metadata = metadata
            row.save()
            AuditLog.objects.create(
                actor=request.user, action="settings_updated",
                entity_type="TLDPricing", entity_id=str(row.pk), entity_name=tld,
                details={"pricing_revision": current + 1, "currency": "NGN",
                         "status": "inactive_draft", "years": [1,2,5,10],
                         "registrar_execution_enabled": False},
            )
            output = _rate_card(row)
    except IntegrityError:
        return Response({"detail": "Price card changed. Refresh before saving."}, status=409)
    return Response(output, headers={"Cache-Control": "private, no-store"})
