"""Security-first hosting-ready email payload; no password or delivery claims.

A paid invoice isn't a provisioned account. Only independently verified ACTIVE
hosting can enqueue this notice. Delivery is a separate audited worker, OFF.
"""
from urllib.parse import urlsplit
from django.conf import settings
from django.db import transaction

from opanel_bridge.policy import eligible
from services.models import Service
from .models import HostingNotice


class HostingNoticeRefused(ValueError):
    pass


def panel_username(service_id):
    """Version 1 cross-product contract: 'op' + positive base36 service ID."""
    if type(service_id) is not int or not 1 <= service_id < 36 ** 18:
        raise HostingNoticeRefused("Invalid hosting account.")
    digits, alphabet = "", "0123456789abcdefghijklmnopqrstuvwxyz"
    while service_id:
        digits = alphabet[service_id % 36] + digits
        service_id //= 36
    return "op" + digits


def _console_origin():
    raw = getattr(settings, "FRONTEND_URL", "")
    try:
        parsed = urlsplit(raw)
        if (not isinstance(raw, str) or parsed.scheme != "https"
                or not parsed.hostname or parsed.username or parsed.password
                or parsed.fragment or parsed.query or parsed.path not in ("", "/")
                or parsed.port not in (None, 443)):
            raise ValueError
    except (ValueError, TypeError):
        raise HostingNoticeRefused("Verified Console public HTTPS origin is required.") from None
    return parsed.scheme + "://" + parsed.netloc


def _safe(label):
    result = str(label or "").strip()
    if not result or len(result) > 255 or any(ord(c) < 32 or ord(c) == 127 for c in result):
        raise HostingNoticeRefused("Untrusted hosting details cannot be emailed.")
    return result


def draft_hosting_ready(service):
    if not getattr(service, "pk", None) or not eligible(service.client_id, service.pk):
        raise HostingNoticeRefused("Only confirmed eligible hosting can be announced.")
    actual = Service.objects.select_related("client").get(pk=service.pk)
    customer_email = actual.client.email
    if not customer_email or len(customer_email) > 254:
        raise HostingNoticeRefused("Verified customer address is unavailable.")
    domain = _safe(actual.domain_name)
    technical_account = _safe(actual.provider_identifier)
    label = _safe(actual.label)
    url = _console_origin() + f"/client/services/{actual.pk}"
    panel = panel_username(actual.pk)
    body = (
        "Your Octalve Cloud hosting account is ready.\n\n"
        f"Hosting package: {label}\n"
        f"Domain: {domain}\n"
        f"Hosting server account username: {technical_account}\n"
        f"Optional OPanel technical username: {panel}\n"
        f"Next hosting renewal: {actual.next_due_date.date().isoformat()}\n\n"
        f"Manage hosting securely: {url}\n\n"
        "You may enter OPanel directly from your signed-in Octalve Console. "
        "To enable your separate OPanel technical login, first open OPanel "
        "through Console and set your password under Hosting Access / Settings.\n"
        "Hosting server login, OPanel technical login, and WordPress administrator "
        "login are separate credentials and must not be reused.\n\n"
        "We do not send or retain your plaintext password by email. "
        "Never share passwords or payment card details by email.\n"
    )
    return {
        "event_key": f"hosting_ready:v1:{actual.pk}",
        "service": actual, "destination_email": customer_email,
        "subject": f"Your Octalve Cloud hosting is ready — {domain}",
        "text_body": body,
    }


def queue_hosting_ready(service):
    """One DB outbox row per proven account; no SMTP action or password."""
    if not getattr(settings, "CLOUD_HOSTING_READY_QUEUE_ENABLED", False):
        raise HostingNoticeRefused("Customer hosting email queue is disabled.")
    with transaction.atomic():
        payload = draft_hosting_ready(service)
        existing, created = HostingNotice.objects.get_or_create(
            event_key=payload["event_key"],
            defaults={k: v for k,v in payload.items() if k != "event_key"})
        if (existing.service_id != service.pk
                or existing.destination_email != payload["destination_email"]):
            raise HostingNoticeRefused("Conflicting hosting notification identity.")
        return existing, created


def send_hosting_ready(*args, **kwargs):
    """No delivery until separate mail transport, retries and bounce review."""
    raise HostingNoticeRefused("Hosting email delivery is not enabled or qualified.")
