"""Super Admin TLD rate-card drafts. No registrar quote, payment or renewal execution.

Reuses the existing TLDPricing.metadata JSON column: no Production migration.
The public legacy TLD pricing endpoint only sees rows marked 'active'; this
writer preserves active public rates while recording the replacement draft.
"""
import re
from decimal import Decimal, ROUND_UP
from django.core import signing
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.response import Response
from catalog.permissions import InternalSupplierAuthority
from providers.connection_stepup import assert_admin, check_mutation
from providers.connection_models import IntegrationConnection
from providers.connection_registrar_views import TLD_SUPPLIER_QUOTE_SALT
from providers.connection_views import VaultMutationThrottle
from audit.models import AuditLog
from .models import TLDPricing

TERMS = ("1", "2", "5", "10")
TLD_RE = re.compile(r"^\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?){0,2}$")
MONEY_RE = re.compile(r"^(?:0|[1-9][0-9]{0,7})\.[0-9]{2}$")
PUBLICATION_NUMBER_RE = re.compile(r"(?:[0-9]{1,8}|[0-9]{1,3}(?:,[0-9]{3}){1,2})(?:\.[0-9]{1,2})?")


def _publication_number(value, label, *, allow_zero=False):
    if not isinstance(value, str) or not PUBLICATION_NUMBER_RE.fullmatch(value.strip()):
        raise ValidationError(f"Enter a valid {label}, with up to two decimal places.")
    result = Decimal(value.strip().replace(",", ""))
    if result > Decimal("99999999.99") or (result == 0 and not allow_zero):
        raise ValidationError(f"The {label} is outside the allowed range.")
    return result


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


def rate_card_draft(row):
    metadata = row.metadata if isinstance(row.metadata, dict) else {}
    saved = metadata.get("period_pricing_v1")
    saved = saved if isinstance(saved, dict) else {}
    def full(operation, yearly):
        raw = saved.get(operation)
        raw = raw if isinstance(raw, dict) else {}
        return {term: str(raw[term]) if isinstance(raw.get(term), str) else
                str(yearly) if term == "1" else None for term in TERMS}
    return {
        "tld": row.tld, "description": saved.get("description", row.description) or "",
        "currency": "NGN",
        "registration": full("registration", row.register_price),
        "renewal": full("renewal", row.renewal_price),
        "transfer_price": str(saved.get("transfer_price", row.transfer_price)),
        "revision": saved.get("revision", 0) if type(saved.get("revision", 0)) is int else 0,
        "updated_at": row.updated_at.isoformat(),
        "publication": "inactive_draft",
        "published_status": row.status,
        "published_prices": {"registration": str(row.register_price), "renewal": str(row.renewal_price), "transfer": str(row.transfer_price)} if row.status == "active" else None,
        "published_registrar": metadata.get("published_registrar") if row.status == "active" else None,
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
            {"results": [rate_card_draft(row) for row in rows[:300]],
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
            # Only consume an MFA code AFTER schema, money and optimistic
            # revision validation; the OTP update rolls back with this write.
            check_mutation(request.user, password, payload["totp_code"])
            if row.status != "active":
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
                "description": description, "transfer_price": str(transfer),
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
            output = rate_card_draft(row)
    except IntegrityError:
        return Response({"detail": "Price card changed. Refresh before saving."}, status=409)
    return Response(output, headers={"Cache-Control": "private, no-store"})


@api_view(["POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def publish_tld_price_card(request):
    assert_admin(request.user)
    payload = request.data
    required = {"tld", "expected_revision", "confirm_password", "totp_code", "action"}
    optional = {"supplier_quote", "ngn_per_supplier_unit", "pricing_mode", "registration", "renewal"}
    if not isinstance(payload, dict) or not required <= payload.keys() or payload.keys() - (required | optional):
        raise ValidationError("Supply the publication fields.")
    action = payload["action"]
    if action not in ("publish", "unpublish") or type(payload["expected_revision"]) is not int:
        raise ValidationError("Choose a publication action and current revision.")
    if not isinstance(payload["tld"], str) or len(payload["tld"]) > 50 or not TLD_RE.fullmatch(payload["tld"]):
        raise ValidationError("Enter a valid lowercase extension.")
    quote = None
    if action == "publish":
        token = payload.get("supplier_quote")
        if not isinstance(token, str) or len(token) > 2048:
            raise ValidationError("Check live supplier pricing before publishing.")
        try:
            quote = signing.loads(token, salt=TLD_SUPPLIER_QUOTE_SALT, max_age=300)
        except signing.BadSignature:
            raise ValidationError("Supplier quote expired. Check live pricing again.") from None
        if quote["actor_id"] != str(request.user.pk) or quote["tld"] != payload["tld"]:
            raise ValidationError("The supplier quote does not match this price card.")
        fx = (Decimal(1) if quote["currency"] == "NGN"
              else _publication_number(payload.get("ngn_per_supplier_unit"), "exchange rate"))
        retail = {}
        for operation in ("registration", "renewal"):
            cost = Decimal(quote[f"{operation}_cost"]) * fx
            if payload.get("pricing_mode") == "fixed":
                retail[operation] = _publication_number(payload.get(operation), f"{operation} price").quantize(Decimal(".01"))
            elif payload.get("pricing_mode") == "markup":
                markup = _publication_number(payload.get(operation), f"{operation} markup", allow_zero=True)
                retail[operation] = _money(str((cost * (1 + markup / 100)).quantize(Decimal(".01"), rounding=ROUND_UP)))
            else:
                raise ValidationError("Choose fixed retail amounts or percentage markup.")
            if retail[operation] < cost:
                raise ValidationError("Retail price cannot be lower than the converted supplier cost.")

    with transaction.atomic():
        row = TLDPricing.objects.select_for_update().filter(tld=payload["tld"]).first()
        if row is None:
            return Response({"detail": "Save a TLD draft first."}, status=404)
        metadata = dict(row.metadata or {})
        draft = dict(metadata.get("period_pricing_v1", {}))
        if draft.get("revision", 0) != payload["expected_revision"]:
            return Response({"detail": "Price card changed. Refresh before publishing."}, status=409)
        if quote and not IntegrationConnection.objects.select_for_update().filter(
            pk=quote["connection_id"], environment="live", state="draft",
            adapter_key="cloudflare-registrar-live", current_version=quote["credential_version"],
            credential_versions__version=quote["credential_version"], credential_versions__revoked_at__isnull=True,
        ).exists():
            raise ValidationError("The quoted registrar credential changed. Check live pricing again.")
        check_mutation(request.user, payload["confirm_password"], payload["totp_code"])
        draft["revision"] = payload["expected_revision"] + 1
        metadata["period_pricing_v1"] = draft
        if quote:
            metadata["published_registrar"] = {
                "connection_id": quote["connection_id"], "credential_version": quote["credential_version"],
                "revision": draft["revision"],
            }
            row.register_price = retail["registration"]
            row.renewal_price = retail["renewal"]
            row.status = "active"
        else:
            metadata.pop("published_registrar", None)
            row.status = "inactive"
        row.metadata = metadata
        row.save()
        AuditLog.objects.create(
            actor=request.user, action="settings_updated", entity_type="TLDPricing",
            entity_id=str(row.pk), entity_name=row.tld,
            details={"publication": action, "revision": draft["revision"], "supplier_quote": quote,
                     "ngn_per_supplier_unit": str(fx) if quote else None,
                     "retail_registration": str(row.register_price), "retail_renewal": str(row.renewal_price)},
        )
    return Response(rate_card_draft(row), headers={"Cache-Control": "private, no-store"})
