"""Customer-authorized operational notices, computed from real billing/domain records.

No email or registrar message is sent by GET; no synthetic notice history. The
existing User.metadata JSON persists only bounded read state and UI preferences.
"""
from datetime import timedelta
from urllib.parse import urlsplit

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.models import Invoice
from domains.models import Domain
from settings_registry.models import Setting

STATE_KEY = "console_notices_v1"
DEFAULTS = {"show_login_alerts": True, "invoice_alerts": True, "domain_alerts": True}
MAX_READ_KEYS = 150


def _client(request):
    user = request.user
    return bool(user.is_authenticated and user.is_active and
                user.role == "client")


def _state(user):
    meta = user.metadata if isinstance(user.metadata, dict) else {}
    state = meta.get(STATE_KEY)
    if not isinstance(state, dict):
        state = {}
    read = state.get("read")
    read = read if isinstance(read, list) else []
    return {
        "preferences": {
            key: state.get("preferences", {}).get(key, value)
            if isinstance(state.get("preferences"), dict)
            and type(state.get("preferences", {}).get(key, value)) is bool
            else value
            for key, value in DEFAULTS.items()
        },
        "read": [r for r in read if isinstance(r, str) and len(r) <= 90][-MAX_READ_KEYS:],
    }


def _notices(user, now=None):
    now = now or timezone.now()
    invoice_start = now - timedelta(days=45)
    invoice_end = now + timedelta(days=14)
    domain_start = now - timedelta(days=7)
    domain_end = now + timedelta(days=35)
    items = []

    invoices = (Invoice.objects.filter(
        client=user, status__in=("unpaid", "partially_paid", "overdue"),
        amount_due__gt=0, due_date__gte=invoice_start, due_date__lte=invoice_end,
    ).order_by("due_date", "pk")[:100])
    for bill in invoices:
        overdue = bill.due_date < now
        days = (bill.due_date - now).total_seconds() / 86400
        stage = "overdue" if overdue else ("one_day" if days <= 1 else
                                           "seven_days" if days <= 7 else "fourteen_days")
        key = f"invoice:{bill.pk}:{bill.due_date.date().isoformat()}:{stage}"
        items.append({
            "key": key, "kind": "invoice", "severity": "urgent" if overdue else "attention",
            "title": "Invoice overdue" if overdue else "Invoice due soon",
            "description": f"Invoice {bill.invoice_number} is " + (
                "past its payment due date." if overdue else "approaching its due date."
            ),
            "date": bill.due_date.isoformat(),
            "href": f"/client/invoices/{bill.pk}",
        })

    domains = (Domain.objects.filter(
        client=user, is_active=True, status__in=("active", "expired"),
        expiry_date__gte=domain_start, expiry_date__lte=domain_end,
    ).order_by("expiry_date", "pk")[:100])
    for domain in domains:
        expired = domain.expiry_date < now
        days = (domain.expiry_date - now).total_seconds() / 86400
        stage = "expired" if expired else ("one_day" if days <= 1 else
                                           "seven_days" if days <= 7 else "month")
        key = f"domain:{domain.pk}:{domain.expiry_date.date().isoformat()}:{stage}"
        items.append({
            "key": key, "kind": "domain", "severity": "urgent" if expired else "attention",
            "title": "Domain expired" if expired else "Domain expiring soon",
            "description": f"{domain.domain_name} " + (
                "has reached its recorded expiry date." if expired else "is approaching its recorded expiry date."
            ),
            "date": domain.expiry_date.isoformat(),
            "href": f"/client/domains/{domain.pk}/renewal",
        })
    items.sort(key=lambda item: (0 if item["severity"] == "urgent" else 1,
                                  item["date"], item["key"]))
    return items[:100]


class CustomerInbox(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _client(request):
            return Response({"detail": "Unavailable."}, status=404)
        state = _state(request.user)
        known = set(state["read"])
        records = [{**item, "read": item["key"] in known}
                   for item in _notices(request.user)]
        return Response({
            "items": records,
            "unread_count": sum(not row["read"] for row in records),
            "preferences": state["preferences"],
            "delivery": {"in_app": True, "email_reminders_enabled": False},
        }, headers={"Cache-Control": "private, no-store"})


class CustomerNoticeRead(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _client(request):
            return Response({"detail": "Unavailable."}, status=404)
        key = request.data.get("key") if isinstance(request.data, dict) else None
        if not isinstance(key, str) or len(key) > 90:
            return Response({"key": ["Invalid notice."]}, status=400)
        # Never accept a guessed event from a different customer.
        if key not in {notice["key"] for notice in _notices(request.user)}:
            return Response({"detail": "Notice unavailable."}, status=404)
        with transaction.atomic():
            user = type(request.user).objects.select_for_update().get(pk=request.user.pk)
            meta = dict(user.metadata) if isinstance(user.metadata, dict) else {}
            state = _state(user)
            updated = [entry for entry in state["read"] if entry != key] + [key]
            meta[STATE_KEY] = {"read": updated[-MAX_READ_KEYS:],
                               "preferences": state["preferences"]}
            user.metadata = meta
            user.save(update_fields=["metadata"])
        return Response({"key": key, "read": True},
                        headers={"Cache-Control": "private, no-store"})


class CustomerNoticePreferences(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _client(request):
            return Response({"detail": "Unavailable."}, status=404)
        return Response(_state(request.user)["preferences"],
                        headers={"Cache-Control": "private, no-store"})

    def patch(self, request):
        if not _client(request):
            return Response({"detail": "Unavailable."}, status=404)
        updates = request.data
        if not isinstance(updates, dict) or not updates or any(
            name not in DEFAULTS or type(value) is not bool
            for name, value in updates.items()
        ):
            return Response({"detail": "Use supported boolean preferences only."},
                            status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            user = type(request.user).objects.select_for_update().get(pk=request.user.pk)
            meta = dict(user.metadata) if isinstance(user.metadata, dict) else {}
            state = _state(user)
            state["preferences"].update(updates)
            meta[STATE_KEY] = state
            user.metadata = meta
            user.save(update_fields=["metadata"])
        return Response(state["preferences"],
                        headers={"Cache-Control": "private, no-store"})


def _safe_community_link(raw, provider):
    if not isinstance(raw, str) or len(raw) > 500:
        return None
    try:
        parsed = urlsplit(raw.strip())
    except ValueError:
        return None
    try:
        forbidden = (parsed.scheme != "https" or parsed.username or
                     parsed.password or parsed.port is not None or
                     parsed.query or parsed.fragment)
    except ValueError:
        return None
    if forbidden:
        return None
    if provider == "whatsapp" and parsed.hostname == "whatsapp.com":
        if not parsed.path.startswith("/channel/") or len(parsed.path) < 15:
            return None
    elif provider == "telegram" and parsed.hostname == "t.me":
        if not parsed.path.startswith("/") or len(parsed.path) < 3:
            return None
    else:
        return None
    return parsed.geturl()


class CustomerCommunity(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _client(request):
            return Response({"detail": "Unavailable."}, status=404)
        community = {"whatsapp": None, "telegram": None}
        configured = Setting.objects.filter(
            group__key="general", key__in=("ocloud_whatsapp_channel", "ocloud_telegram_channel"),
            is_deprecated=False, is_public=True, is_encrypted=False,
        ).select_related("group")
        for setting in configured:
            provider = "whatsapp" if setting.key == "ocloud_whatsapp_channel" else "telegram"
            community[provider] = _safe_community_link(setting.value, provider)
        return Response({"links": community, "automatic_enrollment": False},
                        headers={"Cache-Control": "private, no-store"})
