"""Prevent Django password sessions bypassing privileged Console passkeys."""

from django.conf import settings
from django.http import HttpResponseForbidden
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import PermissionDenied

from .privileged_mfa import privileged_mfa_required


class ConsoleSessionAuthentication(SessionAuthentication):
    def authenticate(self, request):
        user = getattr(request._request, "user", None)
        if user and user.is_authenticated and privileged_mfa_required(user):
            raise PermissionDenied("Use the passkey-protected Console sign-in.")
        return super().authenticate(request)


class PrivilegedAdminBoundary:
    """Django admin stays closed while mandatory Console WebAuthn is enforced."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if settings.CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED and (
            request.path_info.rstrip("/") in {"/admin", "/api-auth"}
            or request.path_info.startswith(("/admin/", "/api-auth/"))
        ):
            return HttpResponseForbidden("Use the passkey-protected Console.")
        return self.get_response(request)
