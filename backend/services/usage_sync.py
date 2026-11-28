"""Bounded, read-only usage synchronization using current supplier authority.

No generic API proxy, browser-supplied accounts, or fabricated resource values.
The existing service usage table is the sole customer snapshot store.
"""
import base64
import re
from datetime import timedelta
from decimal import Decimal, InvalidOperation, ROUND_CEILING
from urllib.parse import parse_qs

from django.conf import settings
from django.db import DatabaseError, transaction
from django.db.models import Q, F
from django.utils import timezone
from accounts.security_throttle import _spend
from opanel_bridge.policy import eligible, refresh_candidate, account_digest
from opanel_bridge.readback import verify_existing_account, ReadbackRejected
from providers.connection_models import IntegrationConnection
from providers.connection_vault import VaultUnavailable
from providers.hosting_runtime import load_hosting_connection
from providers.models import Provider
from providers.pinned_egress import pinned_get, SupplierEgressDenied
from services.models import Service, ServiceUsage
from services.resource_protocol import _count, ResourceRefused

ATTEMPT = "hosting_usage_attempt_v1"
PERIOD = timedelta(hours=24)


class UsageRefused(ValueError):
    pass


def _mb(value, *, limit=False, explicit_units=False):
    if limit and isinstance(value, str) and value.lower() == "unlimited":
        return 0, True
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise UsageRefused("Missing usage value.")
    pattern = r"([0-9]{1,15}(?:\.[0-9]{1,8})?)\s*(B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)" if explicit_units else r"([0-9]{1,15}(?:\.[0-9]{1,8})?)"
    match = re.fullmatch(pattern, str(value).strip(), re.IGNORECASE)
    if not match:
        raise UsageRefused("Invalid usage value or unit.")
    try:
        amount = Decimal(match[1])
        if explicit_units:
            factors = {"b": Decimal(1)/1048576, "kb": Decimal(1)/1024,
                       "kib": Decimal(1)/1024, "mb": Decimal(1), "mib": Decimal(1),
                       "gb": Decimal(1024), "gib": Decimal(1024),
                       "tb": Decimal(1048576), "tib": Decimal(1048576)}
            amount *= factors[match[2].lower()]
        rounded = int(amount.to_integral_value(rounding=ROUND_CEILING))
        if rounded > 10**12:
            raise UsageRefused("Usage exceeds supported range.")
        return rounded, False
    except (InvalidOperation, ValueError, OverflowError):
        raise UsageRefused("Invalid usage quantity.") from None


def _form(response):
    if response.status_code != 200 or len(response.content) > 100000:
        raise UsageRefused("Invalid usage response.")
    try:
        values = parse_qs(response.text, keep_blank_values=True, max_num_fields=500)
    except ValueError:
        raise UsageRefused("Invalid usage response.") from None
    if any(len(v) != 1 for v in values.values()) or values.get("error", ["0"]) != ["0"]:
        raise UsageRefused("Ambiguous or refused usage response.")
    return {k: v[0] for k, v in values.items()}


def _add_resource_count(values, kind, used, limit):
    """Missing/invalid counts stay explicitly unknown, never fabricate zero."""
    try:
        count = _count(used)
        maximum = _count(limit, unlimited=True)
    except ResourceRefused:
        return
    values[kind+"_used"] = count
    values[kind+"_limit"] = maximum if maximum is not None else 0
    values["raw_data"].setdefault("resource_counts", {})[kind] = {
        "used": count, "limit": maximum, "unlimited": maximum is None}


def _directadmin(config, response):
    usage = _form(response)
    values = _metrics(usage.get("quota"), config.get("quota"),
                      usage.get("bandwidth"), config.get("bandwidth"))
    for kind, field in (("email","nemails"),("database","mysql"),("subdomains","nsubdomains")):
        _add_resource_count(values, kind, usage.get(field), config.get(field))
    return values


def _metrics(disk, disk_max, bandwidth, bandwidth_max, *, units=False):
    du, _ = _mb(disk, explicit_units=units)
    dl, di = _mb(disk_max, limit=True, explicit_units=units)
    bu, _ = _mb(bandwidth, explicit_units=units)
    bl, bi = _mb(bandwidth_max, limit=True, explicit_units=units)
    return {"disk_used_mb": du, "disk_limit_mb": dl,
            "bandwidth_used_mb": bu, "bandwidth_limit_mb": bl,
            "raw_data": {"source": "verified_supplier_usage_v1",
                         "disk_unlimited": di, "bandwidth_unlimited": bi}}


def _whm(response):
    if response.status_code != 200 or len(response.content) > 100000:
        raise UsageRefused("Invalid usage response.")
    try:
        body = response.json()
        meta = body["metadata"]
        uapi = body["data"]["uapi"]
        # WHM wraps the UAPI result; require both explicit success envelopes.
        result = uapi["result"]
        if (meta["command"] != "uapi_cpanel" or str(meta["result"]) != "1"
                or uapi.get("module") != "StatsBar" or uapi.get("func") != "get_stats"
                or str(result["status"]) != "1" or result.get("errors")):
            raise UsageRefused("Supplier stats not confirmed.")
        entries = result["data"]
        if not isinstance(entries, list) or len(entries) not in (2,5):
            raise UsageRefused("Missing or ambiguous stats.")
        by_id = {entry["id"]: entry for entry in entries}
        if len(by_id) != len(entries) or set(by_id) not in ({"diskusage", "bandwidthusage"}, {"diskusage", "bandwidthusage", "emailaccounts", "sqldatabases", "subdomains"}):
            raise UsageRefused("Unexpected stats.")
        d, b = by_id["diskusage"], by_id["bandwidthusage"]
        values = _metrics(d["count"], d["max"], b["count"], b["max"], units=True)
        for kind, field in (("email","emailaccounts"),("database","sqldatabases"),("subdomains","subdomains")):
            row=by_id.get(field,{})
            _add_resource_count(values,kind,row.get("_count"),row.get("_max"))
        return values
    except (ValueError, KeyError, TypeError, AttributeError, OverflowError):
        raise UsageRefused("Invalid supplier stats.") from None


def enabled():
    return bool(getattr(settings, "OPANEL_READBACK_ENABLED", False)
                and getattr(settings, "CLOUD_SUPPLIER_PINNED_READBACK_ENABLED", False)
                and getattr(settings, "CLOUD_HOSTING_CONFIGURED_EGRESS_ENABLED", False))


def synchronize(service_id):
    """One validated snapshot per bounded attempt; never change a service term."""
    if not enabled():
        return False
    try:
        service = Service.objects.get(pk=service_id, service_type="hosting", status="active")
        candidate = eligible(service.client_id, service.pk) or refresh_candidate(service.client_id, service.pk)
        if not candidate:
            return False
        service, proof = candidate
        provider = Provider.objects.get(pk=service.provider_id)
        row, key, _ = load_hosting_connection(provider)
        if _spend("hosting:usage_sync", str(service.pk), 1, 3600):
            return False
        identity = account_digest(service)
        if not identity or identity != proof.account_digest:
            return False
        origin = row.public_settings["server_url"]
        binding = (origin, row.public_settings["server_ip"])
        captured = []
        def capture(url, **kwargs):
            response = pinned_get(url, **kwargs)
            captured.append(response)
            return response
        verify_existing_account(service, provider, getter=capture)
        if row.adapter_key == "directadmin":
            path = "/CMD_API_SHOW_USER_USAGE"
            params = {"user": service.provider_identifier}
            auth = "Basic " + base64.b64encode((provider.username+":"+key).encode()).decode()
            config = _form(captured[0])
        elif row.adapter_key == "cpanel-whm":
            path = "/json-api/uapi_cpanel"
            params = {"api.version": "1", "cpanel.user": service.provider_identifier,
                      "cpanel.module": "StatsBar", "cpanel.function": "get_stats",
                      "display": ("bandwidthusage|diskusage|emailaccounts|sqldatabases|subdomains"
                                  if getattr(settings,"CLOUD_HOSTING_NATIVE_RESOURCES_ENABLED",False)
                                  else "bandwidthusage|diskusage")}
            auth = "whm "+provider.username+":"+key
        else:
            return False
        response = pinned_get(origin+path, params=params,
            headers={"Authorization": auth, "Accept": "application/json"},
            timeout=8, allow_redirects=False, verify=True, bound_origin=binding)
        values = _directadmin(config, response) if row.adapter_key == "directadmin" else _whm(response)
        with transaction.atomic():
            fresh = Service.objects.select_for_update().get(pk=service.pk)
            IntegrationConnection.objects.select_for_update().get(pk=row.pk)
            current = Provider.objects.select_for_update().get(pk=provider.pk)
            found = eligible(fresh.client_id, fresh.pk) or refresh_candidate(fresh.client_id, fresh.pk)
            if (not found or found[1].pk != proof.pk or fresh.client_id != service.client_id
                    or fresh.provider_id != service.provider_id
                    or fresh.provider_identifier != service.provider_identifier
                    or fresh.provider_package_id != service.provider_package_id
                    or fresh.domain_name != service.domain_name or current.config != provider.config
                    or account_digest(fresh) != identity):
                return False
            ServiceUsage.objects.create(service=fresh, **values)
        return True
    except (Service.DoesNotExist, Provider.DoesNotExist, IntegrationConnection.DoesNotExist,
            VaultUnavailable, ReadbackRejected, SupplierEgressDenied, UsageRefused, DatabaseError):
        return False


def run_due_usage(limit=1):
    summary = {"enabled": enabled(), "recorded": 0, "held": 0}
    if not summary["enabled"]:
        return summary
    cutoff = (timezone.now()-PERIOD).isoformat()
    rows = Service.objects.filter(service_type="hosting", status="active",
        next_due_date__gt=timezone.now(), opanel_binding__isnull=False,
        opanel_binding__revoked_at__isnull=True).filter(
        Q(metadata__hosting_usage_attempt_v1__isnull=True) |
        Q(metadata__hosting_usage_attempt_v1__lte=cutoff)).order_by(
        F("metadata__hosting_usage_attempt_v1").asc(nulls_first=True), "pk")
    for pk in list(rows.values_list("pk", flat=True)[:min(max(limit, 1), 2)]):
        # Record attempt first; failed suppliers cannot starve newer accounts.
        with transaction.atomic():
            service = Service.objects.select_for_update().get(pk=pk)
            if service.metadata.get(ATTEMPT, "") > cutoff:
                continue
            service.metadata = {**service.metadata, ATTEMPT: timezone.now().isoformat()}
            service.save(update_fields=["metadata"])
        if synchronize(pk):
            summary["recorded"] += 1
        else:
            summary["held"] += 1
    return summary
