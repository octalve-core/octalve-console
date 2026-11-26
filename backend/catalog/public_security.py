"""Anonymous fixed-provider reputation lookup with a shared fail-closed budget."""
from uuid import UUID

from django.conf import settings
from django.db import DatabaseError
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from accounts.account_self_service import reserve_email_attempt
from providers.connection_audit import verify_chain
from providers.connection_models import IntegrationConnection, IntegrationCredentialVersion
from providers.connection_vault import VaultUnavailable, unseal_version
from providers.connection_views import connection_database_qualified
from providers.web_risk import WebRiskUnavailable, lookup, valid_lookup_url


class WebRiskThrottle(AnonRateThrottle):
    scope = "public_web_risk"
    rate = "5/min"


def configured_key():
    if not (
        settings.CLOUD_PUBLIC_WEB_RISK_ENABLED
        and settings.CLOUD_PROVIDER_CUSTODY_VERIFIED
        and settings.CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED
        and not settings.DEBUG
        and connection_database_qualified()
    ):
        raise WebRiskUnavailable()
    version_number = settings.CLOUD_PUBLIC_WEB_RISK_CREDENTIAL_VERSION
    if type(version_number) is not int or version_number < 1:
        raise WebRiskUnavailable()
    row = IntegrationConnection.objects.get(
        pk=UUID(settings.CLOUD_PUBLIC_WEB_RISK_CONNECTION_ID),
        adapter_key="google-web-risk", environment="live", state="draft",
        current_version=version_number,
    )
    verify_chain(row)
    version = IntegrationCredentialVersion.objects.get(
        connection=row, version=version_number, revoked_at__isnull=True,
    )
    return unseal_version(version)["api_key"]


class PublicWebRisk(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]
    throttle_classes = [WebRiskThrottle]

    def post(self, request):
        headers = {"Cache-Control": "no-store"}
        try:
            size = int(request.META.get("CONTENT_LENGTH", "0"))
        except (ValueError, TypeError):
            size = 0
        if not 1 <= size <= 4096:
            return Response({"detail": "Invalid lookup request size."}, status=400, headers=headers)
        body = request.data
        if not isinstance(body, dict) or set(body) != {"url"} or not valid_lookup_url(body["url"]):
            return Response({"detail": "Enter a public HTTP or HTTPS URL."}, status=400, headers=headers)
        try:
            key = configured_key()
            if not reserve_email_attempt("public-web-risk-provider", "global", 100, 86400):
                return Response({"detail": "Lookup limit reached. Try again later."}, status=429, headers=headers)
            threats = lookup(key, body["url"])
        except (DatabaseError, KeyError, TypeError, ValueError, VaultUnavailable,
                IntegrationConnection.DoesNotExist, IntegrationCredentialVersion.DoesNotExist):
            return Response({"detail": "Threat lookup unavailable."}, status=503, headers=headers)
        return Response({
            "provider": "google-web-risk", "url": body["url"],
            "status": "listed" if threats else "not-listed", "threats": threats,
        }, headers=headers)
