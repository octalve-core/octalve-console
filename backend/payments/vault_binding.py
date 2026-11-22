"""Paystack TEST gateway binding to the existing versioned provider vault.

No live charges, no secret copies into PaymentGateway, no Production sandbox
transactions. This only establishes that isolated test checkout may use one
recently verified encrypted credential when all independent flags also pass.
"""
import uuid

from django.conf import settings
from django.db import transaction
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from audit.models import AuditLog
from catalog.permissions import InternalSupplierAuthority
from providers.connection_audit import verify_chain
from providers.connection_models import IntegrationConnection, IntegrationCredentialVersion
from providers.connection_stepup import assert_admin, check_mutation
from providers.connection_views import VaultMutationThrottle, connection_database_qualified
from providers.connection_vault import VaultUnavailable, unseal_version
from providers.connection_status import verification_receipts, safe_verification_status
from .models import PaymentGateway

SOURCE_KEY = "provider_vault_connection_id"
VERSION_KEY = "provider_vault_version"


def _verified_test_connection(row):
    if not row or row.adapter_key != "paystack" or row.state != "draft" or row.environment != "test":
        return False
    try:
        status = safe_verification_status(row, verification_receipts([row]))
        return status["verification_status"] == "verified"
    except Exception:
        return False


def resolve_paystack_test_key(gateway):
    """Server-only read for a TEST-mode gateway; never exposed in HTTP.

    A rotated/revoked/old/unverified credential prevents new checkout. The
    existing hosted-checkout flags and sandbox-only gate still apply.
    """
    if (gateway.code != "paystack" or not gateway.test_mode or
            gateway.status != "test" or gateway.encrypted_secret_key):
        return None
    config = gateway.config if isinstance(gateway.config, dict) else {}
    if set(config) != {SOURCE_KEY, VERSION_KEY}:
        return None
    try:
        connection_id = uuid.UUID(str(config[SOURCE_KEY]))
        version = config[VERSION_KEY]
        if type(version) is not int or version < 1:
            return None
        row = IntegrationConnection.objects.get(pk=connection_id)
        if row.current_version != version or not _verified_test_connection(row):
            return None
        verify_chain(row)
        encrypted = IntegrationCredentialVersion.objects.select_related("connection").get(
            connection=row, version=version, revoked_at__isnull=True)
        secret = unseal_version(encrypted).get("secret_key")
        if not isinstance(secret, str) or not secret.startswith("sk_test_"):
            return None
        return secret
    except Exception:
        # Any vault, audit, schema or custody failure denies checkout.
        return None


@api_view(["GET", "POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def admin_paystack_test_binding(request):
    assert_admin(request.user)
    allowed = bool(getattr(settings, "CLOUD_PAYSTACK_TEST_BINDING_ENABLED", False)
                   and getattr(settings, "CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED", False)
                   and getattr(settings, "CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED", False)
                   and getattr(settings, "CLOUD_PROVIDER_CUSTODY_VERIFIED", False)
                   and not settings.DEBUG and connection_database_qualified())
    if request.method == "GET":
        connections = list(IntegrationConnection.objects.filter(
            adapter_key="paystack", state="draft", environment="test").order_by("-created_at")[:51])
        verified = [{"id":str(row.pk), "label":row.label,
                     "credential_version":row.current_version,
                     "verification_status":safe_verification_status(
                         row, verification_receipts([row]))["verification_status"]}
                    for row in connections[:50]]
        gateway = PaymentGateway.objects.filter(code="paystack").first()
        config = gateway.config if gateway and isinstance(gateway.config,dict) else {}
        return Response({
            "binding_available": allowed,
            "connections": verified,
            "truncated":len(connections)>50,
            "gateway_state":"test_only" if gateway and gateway.status=="test" and gateway.test_mode
                and SOURCE_KEY in config else "not_bound",
            "bound_connection_id":config.get(SOURCE_KEY) if gateway and gateway.test_mode else None,
            "live_payments_enabled":False,
        },headers={"Cache-Control":"private, no-store"})
    if not allowed:
        raise VaultUnavailable()
    if not isinstance(request.data,dict) or set(request.data)!={"connection_id","confirm_password","totp_code"}:
        raise ValidationError({"detail":"Only test connection ID, account password and TOTP may be submitted."})
    try:
        requested = uuid.UUID(request.data["connection_id"])
    except (ValueError,TypeError,AttributeError):
        raise ValidationError({"connection_id":"Valid Paystack connection ID required."}) from None
    check_mutation(request.user,request.data["confirm_password"],request.data["totp_code"])
    with transaction.atomic():
        try:
            row=IntegrationConnection.objects.select_for_update().get(pk=requested)
        except IntegrationConnection.DoesNotExist:
            raise PermissionDenied("Verified Paystack test connection not available.") from None
        if not _verified_test_connection(row):
            raise PermissionDenied("Fresh verified Paystack test connection required.")
        verify_chain(row)
        encrypted = IntegrationCredentialVersion.objects.select_related("connection").get(
            connection=row, version=row.current_version, revoked_at__isnull=True)
        secret = unseal_version(encrypted).get("secret_key")
        if not isinstance(secret,str) or not secret.startswith("sk_test_"):
            raise VaultUnavailable()
        gateway=PaymentGateway.objects.select_for_update().filter(code="paystack").first()
        if gateway:
            prior = gateway.config if isinstance(gateway.config,dict) else {}
            if gateway.encrypted_secret_key or (prior.get(SOURCE_KEY) not in (None,str(row.pk))):
                raise PermissionDenied("A separately controlled gateway configuration exists.")
        else:
            gateway = PaymentGateway(code="paystack",name="Paystack (test only)")
        gateway.name="Paystack (test only)"
        gateway.status="test"
        gateway.test_mode=True
        gateway.encrypted_secret_key=None
        gateway.encrypted_webhook_secret=None
        gateway.config={SOURCE_KEY:str(row.pk),VERSION_KEY:row.current_version}
        gateway.save()
        AuditLog.objects.create(
            actor=request.user,action="gateway_configured",
            entity_type="PaymentGateway",entity_id=str(gateway.pk),entity_name="paystack",
            details={"mode":"test","source":"versioned_provider_vault",
                     "connection_id":str(row.pk),"credential_version":row.current_version,
                     "live_payments_enabled":False},
        )
    return Response({"gateway_state":"test_only","binding_version":row.current_version,
                     "live_payments_enabled":False},
                    headers={"Cache-Control":"private, no-store"})
