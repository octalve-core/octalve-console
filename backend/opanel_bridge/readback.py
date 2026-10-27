"""Read-only DirectAdmin/WHM hosting account verification for OPanel eligibility.

This NEVER provisions hosting. A successful package inventory, 200 response, or
service.status flag is not evidence of a customer account. Changes to proof
records require explicit backend operator action and are default disabled.
"""
import base64
from dataclasses import dataclass
import re
from urllib.parse import parse_qs

import requests
from providers.pinned_egress import pinned_get
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from providers.inventory import _endpoint, InventoryError
from providers.models import Provider
from services.models import Service
from .models import VerifiedHostingBinding
from .policy import account_digest

USERNAME = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{1,31}$")


def required_owner(provider):
    """Configured reseller/owner identity must match vendor read-back verbatim."""
    config = provider.config if isinstance(provider.config, dict) else {}
    owner = config.get("hosting_account_owner")
    if not isinstance(owner, str) or not USERNAME.fullmatch(owner):
        raise ReadbackRejected("Expected hosting account owner has not been approved.")
    return owner


def unique_account(service, account=None):
    """Never bind one provider account to multiple Console services."""
    account = account if account is not None else service.provider_identifier
    if not account:
        return False
    return not Service.objects.filter(
        provider_id=service.provider_id,
        provider_identifier__iexact=account,
    ).exclude(pk=service.pk).exists()



class ReadbackRejected(Exception):
    """Redacted failure: provider raw responses/credentials MUST NOT be logged."""


@dataclass(frozen=True)
class ReadbackResult:
    account_confirmed: bool
    adapter: str
    service_id: int
    provider_id: int
    checked_at: object


def _normalize_domain(value):
    if not isinstance(value, str):
        return ""
    return value.strip().rstrip(".").lower()


def _da_account(data, account, domain, owner):
    if isinstance(data, str):
        # Do not permit duplicate ambiguous keys or oversized provider replies.
        fields = parse_qs(data, keep_blank_values=True, strict_parsing=False)
        if any(len(values) != 1 for values in fields.values()):
            raise ReadbackRejected("DirectAdmin account response is ambiguous.")
        data = {key: values[0] for key, values in fields.items()}
    if not isinstance(data, dict):
        raise ReadbackRejected("Unrecognized DirectAdmin account response.")
    if (
        str(data.get("error", "0")) != "0"
        or data.get("username") != account
        or data.get("creator") != owner
        or _normalize_domain(data.get("domain")) != domain
        or str(data.get("usertype", "")).lower() != "user"
        or str(data.get("account", "")).upper() != "ON"
        or str(data.get("suspended", "")).lower() != "no"
    ):
        raise ReadbackRejected("DirectAdmin account identity or activation not verified.")
    return True


def _whm_account(data, account, domain, owner):
    if not isinstance(data, dict) or not isinstance(data.get("metadata"), dict):
        raise ReadbackRejected("Invalid WHM account response.")
    if str(data["metadata"].get("result")) != "1":
        raise ReadbackRejected("WHM did not confirm account summary.")
    records = data.get("data", {}).get("acct") if isinstance(data.get("data"), dict) else None
    if not isinstance(records, list) or len(records) != 1 or not isinstance(records[0], dict):
        raise ReadbackRejected("WHM returned an ambiguous account summary.")
    item = records[0]
    if (
        item.get("user") != account
        or item.get("owner") != owner
        or _normalize_domain(item.get("domain")) != domain
        or str(item.get("suspended", "")).lower() not in ("0", "false")
    ):
        raise ReadbackRejected("WHM account identity or suspension not verified.")
    return True


def verify_existing_account(service, provider, *, getter=None, pending_account=None):
    """Make one read-only vendor GET. Pre-activation mode is worker-only.

    Normal OPanel readback MUST use active service.provider_identifier.
    A verified paid hosting worker may supply its deterministic expected
    account for an unactivated, server-recorded pending service; this does
    NOT itself activate hosting or make an entitlement available.
    """
    if not getattr(settings, "OPANEL_READBACK_ENABLED", False):
        raise ReadbackRejected("Account read-back is disabled.")
    if (
        service.service_type != "hosting"
        or not (
            (pending_account is None and service.status == "active" and service.activated_at)
            or (pending_account is not None
                and getattr(settings, "CLOUD_PROVISIONING_WORKER_ENABLED", False)
                and service.status == "pending" and service.activated_at is None
                and not service.provider_identifier)
        )
        or service.next_due_date <= timezone.now()
        or service.provider_id != provider.pk
        or provider.status != "active"
        or provider.health_status != "healthy"
        or provider.test_mode
        or not unique_account(service, pending_account)
    ):
        raise ReadbackRejected("Service or provider is not eligible for account verification.")
    owner = required_owner(provider)
    account = service.provider_identifier if pending_account is None else pending_account
    domain = _normalize_domain(service.domain_name)
    if not isinstance(account, str) or not USERNAME.fullmatch(account) or not domain or len(domain) > 253:
        raise ReadbackRejected("Provider account reference is incomplete.")
    if any(ch in domain for ch in ("/", ":", "@", "?", "#", "\\")):
        raise ReadbackRejected("Hosting domain is invalid.")
    try:
        origin = _endpoint(provider)
    except (InventoryError, ValueError):
        raise ReadbackRejected("Provider origin is not on the approved HTTPS allowlist.")
    if provider.adapter_type not in ("DirectAdminAdapter", "CpanelAdapter"):
        raise ReadbackRejected("Only accepted DirectAdmin or WHM read-back is supported.")
    token = provider.get_api_key()
    if not token or not provider.username:
        raise ReadbackRejected("Provider's server-side account token is unavailable.")
    headers = {"Accept": "application/json"}
    if provider.adapter_type == "DirectAdminAdapter":
        encoded = base64.b64encode(f"{provider.username}:{token}".encode()).decode()
        headers["Authorization"] = "Basic " + encoded
        path = "/CMD_API_SHOW_USER_CONFIG"
        args = {"user": account}
    else:
        headers["Authorization"] = f"whm {provider.username}:{token}"
        path = "/json-api/accountsummary"
        args = {"api.version": "1", "user": account}
    try:
        request = getter or pinned_get
        response = request(
            origin + path, params=args, headers=headers,
            timeout=min(max(provider.timeout_seconds or 10, 1), 10),
            allow_redirects=False, verify=True,
        )
    except requests.RequestException as exc:
        raise ReadbackRejected("Provider account read-back failed.") from exc
    if response.status_code != 200 or len(response.content) > 100_000:
        raise ReadbackRejected("Provider refused or oversized the account read-back.")
    if provider.adapter_type == "DirectAdminAdapter":
        _da_account(response.text, account, domain, owner)
    else:
        try:
            _whm_account(response.json(), account, domain, owner)
        except ValueError as exc:
            raise ReadbackRejected("WHM returned malformed JSON.") from exc
    return ReadbackResult(True, provider.adapter_type, service.pk, provider.pk, timezone.now())


def readback_service(service_id, *, apply=False, getter=None):
    """Operator-only backend entry. Never accepts browser-supplied host/account data."""
    if not getattr(settings, "OPANEL_READBACK_ENABLED", False):
        raise ReadbackRejected("Account read-back is disabled.")
    try:
        service = Service.objects.get(pk=service_id)
        provider = Provider.objects.get(pk=service.provider_id)
    except (Service.DoesNotExist, Provider.DoesNotExist, TypeError, ValueError):
        raise ReadbackRejected("Service has no valid configured provider.")
    try:
        result = verify_existing_account(service, provider, getter=getter)
    except ReadbackRejected:
        if apply:
            # A failed confirmation run must immediately revoke old proof;
            # no stale 15-minute permission survives a known negative result.
            with transaction.atomic():
                proof = VerifiedHostingBinding.objects.select_for_update().filter(service_id=service.pk, revoked_at__isnull=True).first()
                if proof is not None:
                    proof.revoked_at = timezone.now()
                    proof.save(update_fields=["revoked_at"])
        raise
    if not apply:
        return result
    with transaction.atomic():
        # Prevent TOCTOU: the service could have been transferred, suspended or
        # relinked while the provider HTTPS request was in flight.
        fresh = Service.objects.select_for_update().get(pk=service.pk)
        live_provider = Provider.objects.get(pk=provider.pk)
        if (
            fresh.client_id != service.client_id
            or fresh.status != "active"
            or fresh.service_type != "hosting"
            or fresh.activated_at != service.activated_at
            or fresh.next_due_date <= timezone.now()
            or fresh.provider_id != provider.pk
            or fresh.provider_identifier != service.provider_identifier
            or not unique_account(fresh)
            or live_provider.adapter_type != provider.adapter_type
            or live_provider.base_url != provider.base_url
            or live_provider.username != provider.username
            or live_provider.config != provider.config
            or live_provider.get_api_key() != provider.get_api_key()
            or _normalize_domain(fresh.domain_name) != _normalize_domain(service.domain_name)
            or live_provider.status != "active"
            or live_provider.health_status != "healthy"
            or live_provider.test_mode
            or result.checked_at < fresh.activated_at
        ):
            raise ReadbackRejected("Service changed during provider verification.")
        proof = VerifiedHostingBinding.objects.select_for_update().filter(service=fresh).first()
        if proof and (
            proof.revoked_at is not None
            or proof.provider_id_snapshot != fresh.provider_id
            or proof.account_digest != account_digest(fresh)
        ):
            # Cascade any unredeemed codes and rotate the OPanel session binding.
            proof.delete()
            proof = None
        if proof is None:
            VerifiedHostingBinding.objects.create(
                service=fresh,
                provider_id_snapshot=fresh.provider_id,
                account_digest=account_digest(fresh),
                confirmation_source="provider_api_readback",
                confirmed_at=result.checked_at,
            )
        else:
            proof.confirmation_source = "provider_api_readback"
            proof.confirmed_at = result.checked_at
            proof.save(update_fields=["confirmation_source", "confirmed_at"])
    return result
