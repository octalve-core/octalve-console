"""Read-only dispatch for an explicitly published registrar connection."""

from uuid import UUID

from django.conf import settings
from django.db import DatabaseError

from providers.cloudflare_int01 import CloudflareINT01, CloudflareINT01Denied, FixedCloudflareTransport
from providers.connection_audit import verify_chain
from providers.connection_models import IntegrationConnection, IntegrationCredentialVersion
from providers.connection_vault import VaultUnavailable, unseal_version
from providers.connection_views import connection_database_qualified


def _cloudflare_check(connection, credentials, domain):
    transport = FixedCloudflareTransport(credentials["api_token"])
    return CloudflareINT01(connection.public_settings["account_id"], transport).live_domain_check(domain)


def _resellerclub_check(connection,credentials,domain):
    from providers.resellerclub_live import ResellerClub
    return ResellerClub(connection.public_settings["reseller_id"],credentials["api_key"],"live").live_domain_check(domain)

LIVE_AVAILABILITY_ADAPTERS = {"cloudflare-registrar-live": _cloudflare_check,"resellerclub":_resellerclub_check}


def query_published_registrar(route, domain):
    """Return a provider answer only for the pinned, current live credential."""
    if not (
        getattr(settings, "CLOUD_PUBLIC_REGISTRAR_LOOKUP_ENABLED", False)
        and settings.CLOUD_REGISTRAR_LIVE_QUOTE_READBACK_ENABLED
        and settings.CLOUD_PROVIDER_CUSTODY_VERIFIED
        and settings.CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED
        and not settings.DEBUG
        and connection_database_qualified()
    ):
        return None
    version_number = route.get("credential_version")
    if type(version_number) is not int or version_number < 1:
        return None
    try:
        connection = IntegrationConnection.objects.get(
            pk=UUID(route["connection_id"]), state="draft", environment="live",
            current_version=version_number, adapter_key__in=LIVE_AVAILABILITY_ADAPTERS,
        )
        verify_chain(connection)
        version = IntegrationCredentialVersion.objects.get(
            connection=connection, version=version_number, revoked_at__isnull=True,
        )
        return LIVE_AVAILABILITY_ADAPTERS[connection.adapter_key](connection, unseal_version(version), domain)
    except (KeyError, TypeError, ValueError, AttributeError, DatabaseError,
            IntegrationConnection.DoesNotExist, IntegrationCredentialVersion.DoesNotExist,
            VaultUnavailable, CloudflareINT01Denied):
        return None


def public_availability(price, domain):
    if price is None or not isinstance(price.metadata, dict):
        return "unverified"
    route = price.metadata.get("published_registrar")
    if not isinstance(route, dict):
        return "unverified"
    result = query_published_registrar(route, domain)
    if result is None:
        return "unverified"
    if result.get("registrable") is True:
        return "available"
    return "unavailable" if result.get("registrable") is False else "unverified"
