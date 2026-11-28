"""INT-03: authenticated, rate-limited Cloudflare Registrar live quote ONLY.

This module has NO registration, renewal, transfer, billing, DNS mutation,
provider purchase or client activation endpoint. Provider prices are NOT a
customer-facing offer and cannot authorize a checkout.
"""
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.db import DatabaseError
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from audit.models import AuditLog
from catalog.permissions import InternalSupplierAuthority
from .cloudflare_int01 import CloudflareINT01, CloudflareINT01Denied, FixedCloudflareTransport, require_domain
from .connection_audit import verify_chain
from .resellerclub_live import ResellerClub,ResellerClubUnavailable
from .connection_models import IntegrationConnection, IntegrationCredentialVersion
from .connection_stepup import assert_admin, check_mutation
from .connection_views import VaultMutationThrottle, connection_database_qualified
from .connection_vault import VaultUnavailable, unseal_version


TLD_SUPPLIER_QUOTE_SALT = "domains.tld-supplier-quote.v1"


@api_view(["POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def live_registrar_quote(request, connection_id):
    assert_admin(request.user)
    if not isinstance(request.data, dict) or set(request.data) != {
        "domain", "confirm_password", "totp_code"
    }:
        raise ValidationError({"detail": "Only the reviewed registrar quote fields are accepted."})

    # Independent from credential mutation, but NEVER inferred from the
    # presence of a saved token, a claimed custody checkbox or an admin role.
    if not (
        getattr(settings, "CLOUD_REGISTRAR_LIVE_QUOTE_READBACK_ENABLED", False)
        and getattr(settings, "CLOUD_PROVIDER_CUSTODY_VERIFIED", False)
        and getattr(settings, "CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED", False)
        and not getattr(settings, "DEBUG", False)
        and connection_database_qualified()
    ):
        raise VaultUnavailable()

    try:
        domain = require_domain(request.data["domain"])
    except CloudflareINT01Denied:
        raise ValidationError({"domain": "Only a valid lowercase .com or .net domain is supported."}) from None

    # Password and one-use RFC6238 code are checked server-side against the
    # owner before ANY supplier call or encrypted credential access.
    check_mutation(request.user, request.data["confirm_password"], request.data["totp_code"])

    try:
        row = IntegrationConnection.objects.get(
            pk=connection_id, adapter_key__in=("cloudflare-registrar-live","resellerclub"), state="draft", environment="live"
        )
    except IntegrationConnection.DoesNotExist:
        return Response({"detail": "Approved registrar connection not found."}, status=404)

    try:
        verify_chain(row)
        version = IntegrationCredentialVersion.objects.select_related("connection").get(
            connection=row, version=row.current_version, revoked_at__isnull=True
        )
        stored = unseal_version(version)
        connector = (ResellerClub(row.public_settings["reseller_id"],stored["api_key"],"live") if row.adapter_key=="resellerclub" else CloudflareINT01(
            row.public_settings["account_id"], FixedCloudflareTransport(stored["api_token"])))
        quote = connector.live_domain_check(domain)
    except (CloudflareINT01Denied, ResellerClubUnavailable, VaultUnavailable,
            IntegrationCredentialVersion.DoesNotExist, KeyError, DatabaseError):
        return Response(
            {"detail": "Live registrar check could not be verified.", "verified": False},
            status=503, headers={"Cache-Control": "private, no-store"}
        )

    checked = timezone.now()
    try:
        AuditLog.objects.create(
            actor=request.user,
            action="provider_connection_test",
            entity_type="IntegrationConnection",
            entity_id=str(row.pk),
            entity_name="Cloudflare live registrar quote",
            details={
                "adapter": row.adapter_key,
                "domain": domain,
                "credential_version": row.current_version,
                "operation": "registrar.domain-check",
                "read_only": True,
                "execution_enabled": False,
                "checked_at": checked.isoformat(),
            },
        )
    except DatabaseError:
        return Response(
            {"detail": "Registrar check succeeded but its audit receipt was not retained."},
            status=503, headers={"Cache-Control": "private, no-store"}
        )
    supplier_quote = None
    if row.environment == "live" and quote.get("registrable") is True:
        supplier_quote = signing.dumps({
            "actor_id": str(request.user.pk),
            "connection_id": str(row.pk),
            "credential_version": version.version,
            "tld": "." + domain.rsplit(".", 1)[1],
            "currency": quote["currency"],
            "registration_cost": quote["registration_cost"],
            "renewal_cost": quote["renewal_cost"],
        }, salt=TLD_SUPPLIER_QUOTE_SALT)
    return Response({
        "verified": True,
        "provider": "resellerclub" if row.adapter_key=="resellerclub" else "cloudflare-registrar",
        "domain": domain,
        "availability": quote,
        "supplier_quote": supplier_quote,
        "supplier_price_only": True,
        "quote_is_retail_offer": False,
        "checkout_enabled": False,
        "registration_enabled": False,
        "execution_enabled": False,
        "checked_at": checked.isoformat(),
        "expires_at": (checked + timedelta(minutes=5)).isoformat(),
    }, headers={"Cache-Control": "private, no-store"})


@api_view(["POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def live_registration_status(request,connection_id):
    """Admin-only independent registrar resource evidence; no ownership grant."""
    assert_admin(request.user)
    if not isinstance(request.data,dict) or set(request.data)!={"domain","confirm_password","totp_code"}:
        raise ValidationError("Use the reviewed registration status fields.")
    if not (getattr(settings,"CLOUD_REGISTRAR_LIVE_QUOTE_READBACK_ENABLED",False)
            and getattr(settings,"CLOUD_PROVIDER_CUSTODY_VERIFIED",False)
            and getattr(settings,"CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED",False)
            and not settings.DEBUG and connection_database_qualified()):
        raise VaultUnavailable()
    try:
        domain=require_domain(request.data["domain"])
    except CloudflareINT01Denied:
        raise ValidationError("Enter a supported lowercase .com or .net name.") from None
    check_mutation(request.user,request.data["confirm_password"],request.data["totp_code"])
    headers={"Cache-Control":"private, no-store"}
    try:
        row=IntegrationConnection.objects.get(pk=connection_id,adapter_key="cloudflare-registrar-live",
            environment="live",state="draft")
        verify_chain(row)
        version=IntegrationCredentialVersion.objects.get(connection=row,version=row.current_version,revoked_at__isnull=True)
        connector=CloudflareINT01(row.public_settings["account_id"],FixedCloudflareTransport(unseal_version(version)["api_token"]))
        proof=connector.live_registration_readback(domain)
        from django.db import transaction
        with transaction.atomic():
            current=IntegrationConnection.objects.select_for_update().get(pk=row.pk)
            if (current.state!="draft" or current.environment!="live" or current.adapter_key!=row.adapter_key
                or current.current_version!=row.current_version or current.public_settings!=row.public_settings
                or current.updated_at!=row.updated_at or not IntegrationCredentialVersion.objects.filter(
                    pk=version.pk,revoked_at__isnull=True).exists()):
                raise VaultUnavailable()
            verify_chain(current)
            AuditLog.objects.create(actor=request.user,action="provider_connection_test",
                entity_type="IntegrationConnection",entity_id=str(row.pk),entity_name="Cloudflare live registration readback",
                details={"operation":"registrar.registration-readback","domain":domain,"credential_version":row.current_version,
                         "read_only":True,"execution_enabled":False,"status":proof["status"]})
    except (CloudflareINT01Denied,VaultUnavailable,IntegrationCredentialVersion.DoesNotExist,
            IntegrationConnection.DoesNotExist,DatabaseError,KeyError,ValueError):
        return Response({"verified":False,"detail":"Registration readback could not be confirmed."},status=503,headers=headers)
    return Response({"verified":True,"registration":proof,"customer_ownership_verified":False,
                     "execution_enabled":False},headers=headers)
