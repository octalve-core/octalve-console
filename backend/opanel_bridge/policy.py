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
    domain = (service.domain_name or "").strip().rstrip(".").lower()
    key = f"{service.provider_id}:{service.provider_identifier or ''}:{domain}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def eligible(subject_id, service_id):
    """Return (service, binding) only with independently recorded provider proof."""
    from services.models import Service
    try:
        service = Service.objects.select_related("client").get(pk=service_id, client_id=subject_id)
    except (Service.DoesNotExist, ValueError, TypeError):
        return None
    user = service.client
    if not user.is_active or user.role != "client" or getattr(user, "is_locked", False):
        return None
    if service.service_type != "hosting" or service.status != "active":
        return None
    if not service.provider_id or not service.provider_identifier or not service.activated_at:
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
        or (now - proof.confirmed_at).total_seconds() > 900
        or proof.provider_id_snapshot != service.provider_id
        or proof.account_digest != account_digest(service)
    ):
        return None
    return service, proof
