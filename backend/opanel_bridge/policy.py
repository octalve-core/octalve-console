"""Authoritative Console entitlement checks; never rely on frontend state."""
import hashlib
from urllib.parse import urlparse
from django.conf import settings
from django.utils import timezone
from .models import VerifiedHostingBinding


def enabled():
    callback = getattr(settings, "OPANEL_CALLBACK_URL", "")
    parsed = urlparse(callback)
    return (
        getattr(settings, "OPANEL_ISSUER_ENABLED", False)
        and len(getattr(settings, "OPANEL_CLIENT_SECRET", "")) >= 32
        and parsed.scheme == "https"
        and bool(parsed.hostname)
        and not parsed.username and not parsed.password
        and not parsed.fragment and not parsed.query
    )


def account_digest(service):
    """Proof binds provider origin, reseller and encrypted-token revision too."""
    from providers.models import Provider
    provider = Provider.objects.filter(pk=service.provider_id).first()
    if provider is None:
        return ""
    config = provider.config if isinstance(provider.config, dict) else {}
    owner = config.get("hosting_account_owner")
    if not isinstance(owner, str) or not owner:
        return ""
    domain = (service.domain_name or "").strip().rstrip(".").lower()
    if config.get("hosting_vault_connection_id"):
        from providers.hosting_runtime import load_hosting_connection
        from providers.connection_vault import VaultUnavailable
        try:
            row,_,policy=load_hosting_connection(provider)
        except VaultUnavailable:
            return ""
        return hashlib.sha256(repr((service.provider_id,service.provider_identifier,domain,
            str(row.pk),row.current_version,config.get("hosting_execution_policy_v1",{}).get("mac"))).encode()).hexdigest()
    key = "|".join((
        str(service.provider_id),
        str(service.provider_identifier or "").lower(),
        domain,
        provider.adapter_type,
        provider.base_url,
        str(provider.username or ""),
        str(owner),
        str(provider.encrypted_api_key or ""),
    ))
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def _bound_entitlement(subject_id, service_id, *, permit_stale=False):
    """Internal candidate lookup; stale results never authorize panel access."""
    from services.models import Service
    try:
        service = Service.objects.select_related("client").get(pk=service_id, client_id=subject_id)
    except (Service.DoesNotExist, ValueError, TypeError):
        return None
    user = service.client
    if not user.is_active or user.role != "client" or getattr(user, "is_locked", False):
        return None
    if (service.metadata.get("hosting_cancellation_v1",{}).get("state") in ("suspend_uncertain","terminate_uncertain")
            or service.metadata.get("hosting_lifecycle_v1",{}).get("state")=="dispatched_uncertain"
            or service.service_type != "hosting" or service.status != "active"):
        return None
    if not service.provider_id or not service.provider_identifier or not service.activated_at:
        return None
    # Deny stale or contradictory provider authority, even if a previous
    # proof remains within the 15-minute validity window.
    from providers.models import Provider
    provider = Provider.objects.filter(pk=service.provider_id).first()
    if (provider is None or provider.status != "active"
            or provider.health_status != "healthy" or provider.test_mode):
        return None
    config = provider.config if isinstance(provider.config, dict) else {}
    owner = config.get("hosting_account_owner")
    if not isinstance(owner, str) or not owner:
        return None
    # Cross-service aliasing could allow a second Console customer to manage
    # the same underlying hosting account. Block both bindings, fail closed.
    if Service.objects.filter(
        provider_id=service.provider_id,
        provider_identifier__iexact=service.provider_identifier,
    ).exclude(pk=service.pk).exists():
        return None
    now = timezone.now()
    if service.next_due_date <= now or service.activated_at > now:
        return None
    try:
        proof = service.opanel_binding
    except VerifiedHostingBinding.DoesNotExist:
        return None
    if (
        proof.revoked_at is not None
        or proof.confirmation_source != "provider_api_readback"
        or proof.confirmed_at is None
        or proof.confirmed_at < service.activated_at
        or proof.confirmed_at > now
        or (not permit_stale and (now - proof.confirmed_at).total_seconds() > 900)
        or proof.provider_id_snapshot != service.provider_id
        or not account_digest(service)
        or proof.account_digest != account_digest(service)
    ):
        return None
    return service, proof


def eligible(subject_id, service_id):
    """Return an entitlement only with a fresh, independent provider proof."""
    return _bound_entitlement(subject_id, service_id)


def refresh_candidate(subject_id, service_id):
    """Only refresh an existing, unrevoked vault-bound proof for its owner.

    A stale proof is never itself authority to issue or redeem a session.
    Missing, revoked, transferred or otherwise inconsistent bindings require
    separate recovery; this path cannot recreate those entitlements.
    """
    from providers.models import Provider
    if not getattr(settings, "OPANEL_READBACK_ENABLED", False):
        return None
    found = _bound_entitlement(subject_id, service_id, permit_stale=True)
    if not found:
        return None
    service, proof = found
    if (timezone.now() - proof.confirmed_at).total_seconds() <= 900:
        return None
    if not Provider.objects.filter(pk=service.provider_id,
            config__has_key="hosting_vault_connection_id").exists():
        return None
    return found
