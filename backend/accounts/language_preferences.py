"""Batch 14: owner-scoped language preference, no extra tables or migrations.

Only tested locales are exposed. The French pilot is disabled in Production
until all role routes, accessibility and financial language have been reviewed.
"""
from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

LOCALES = {"en": "English", "fr": "Français"}


def available_locales():
    return LOCALES if getattr(settings, "CLOUD_MULTILINGUAL_ENABLED", False) else {"en": "English"}


class OwnLanguagePreferenceView(APIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def snapshot(self, user):
        enabled = bool(getattr(settings, "CLOUD_MULTILINGUAL_ENABLED", False))
        available = available_locales()
        preferred = user.language if user.language in available else "en"
        return {
            "language": preferred,
            "enabled": enabled,
            "available_languages": [{"code": code, "name": name} for code, name in available.items()],
            "scope": "pilot-settings-only" if enabled else "english-only",
        }

    def get(self, request):
        return Response(self.snapshot(request.user))

    def patch(self, request):
        payload = request.data
        if not isinstance(payload, dict) or set(payload) != {"language"}:
            return Response({"language": ["Supply only one language code."]}, status=400)
        requested = payload.get("language")
        if not isinstance(requested, str) or requested not in LOCALES:
            return Response({"language": ["Unsupported language code."]}, status=400)
        if requested not in available_locales():
            return Response({"language": ["This translation is not available yet."]}, status=409)
        if request.user.language != requested:
            request.user.language = requested
            request.user.save(update_fields=["language", "updated_at"])
        return Response(self.snapshot(request.user))
