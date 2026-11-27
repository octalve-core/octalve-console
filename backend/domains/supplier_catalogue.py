"""Supplier catalogue evidence, never a customer offer or write authority."""
from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from audit.models import AuditLog
from providers.cloudflare_int01 import require_domain, CloudflareINT01Denied
from providers.connection_models import IntegrationConnection
from providers.connection_status import safe_verification_status, verification_receipts
from .models import TLDPricing
from .pilot import registrar

KEY = "sandbox_supplier_catalogue_v1"

def choose_candidate(candidates, *, years):
    """Choose a verified, executable standard quote in a single currency.

    Unqualified, stale, unsupported and cross-currency candidates cannot win.
    Never switch an already reserved registration to a different supplier.
    """
    if type(years) is not int or years not in (1,2,5,10):
        return None
    eligible = [c for c in candidates if c.get("credential_verified") is True
                and c.get("contract_qualified") is True and c.get("available") is True
                and years in c.get("terms", []) and c.get("environment") == "test"
                and c.get("adapter") in ("cloudflare-registrar", "resellerclub")]
    if not eligible or len({c["currency"] for c in eligible}) != 1:
        return None
    try:
        costs = [(Decimal(c["registration_cost"]), Decimal(c["renewal_cost"]), c) for c in eligible]
        if any(not a.is_finite() or not b.is_finite() or a <= 0 or b <= 0 for a,b,_ in costs):
            return None
        return min(costs, key=lambda item: (item[0] + (years-1)*item[1], item[2]["adapter"]))[2]
    except (InvalidOperation, KeyError, TypeError, ValueError):
        return None

def import_cloudflare_catalogue(domain, actor):
    domain = require_domain(domain)
    supplier, binding = registrar()
    extension = domain.rsplit(".", 1)[1]
    terms = supplier.supported_registration_terms(extension)
    quote = supplier.check(domain)
    if (quote.get("name") != domain or quote.get("registrable") is not True
            or quote.get("tier") != "standard" or not terms):
        raise ValidationError("An available standard sandbox name and explicit term schema are required.")
    checked = timezone.now()
    entry = {"adapter": "cloudflare-registrar", "environment": "test",
             "connection": binding["connection"], "version": binding["version"],
             "sample_domain": domain, "currency": quote["currency"],
             "registration_cost": quote["registration_cost"], "renewal_cost": quote["renewal_cost"],
             "terms": terms, "checked_at": checked.isoformat(), "sample_only": True,
             "commercial_execution": False}
    with transaction.atomic():
        # No provider network request while database locks are held.
        row, _ = TLDPricing.objects.get_or_create(tld="."+extension, defaults={
            "status":"inactive", "register_price":0, "renewal_price":0, "transfer_price":0})
        row = TLDPricing.objects.select_for_update().get(pk=row.pk)
        connection = IntegrationConnection.objects.select_for_update().filter(
            pk=binding["connection"], adapter_key="cloudflare-registrar", environment="test",
            state="draft", current_version=binding["version"]).first()
        if not connection or safe_verification_status(connection, verification_receipts([connection]))["verification_status"] != "verified":
            raise ValidationError("The supplier connection changed. Refresh catalogue evidence.")
        metadata = dict(row.metadata or {})
        catalogue = dict(metadata.get(KEY, {}))
        catalogue["cloudflare-registrar"] = entry
        metadata[KEY] = catalogue
        row.metadata = metadata
        row.save(update_fields=["metadata", "updated_at"])
        AuditLog.objects.create(actor=actor, action="settings_updated", entity_type="TLDPricing",
            entity_id=str(row.pk), entity_name=row.tld, details={"supplier_catalogue":entry,
                "retail_prices_changed":False, "live_execution_enabled":False})
    return {"mode":"sandbox_catalogue", "domain":domain, "catalogue":entry,
            "checked_at":checked.isoformat(), "execution_enabled":False}
