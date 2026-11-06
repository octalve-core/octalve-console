"""DNS-01: exact tenant/domain/zone authority. Read-only supplier operations only.

Admin prepares the bound zone with fresh MFA and documentary consent evidence.
Customer explicitly opts in. Admin separately approves against a fresh live
Cloudflare check. Only the exact owner (or verified superadmin) can read records.
No DNS writes, nameserver changes, registrar orders or provider secret output.
"""
import re
import uuid
from django.conf import settings
from django.db import DatabaseError, IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, Throttled, ValidationError
from rest_framework.response import Response

from audit.models import AuditLog
from accounts.security_throttle import _spend as spend_durable_auth_attempt
from providers.cloudflare_int01 import (
    CloudflareINT01, CloudflareINT01Denied, FixedCloudflareTransport, require_id,
)
from providers.connection_audit import verify_chain
from providers.connection_models import IntegrationConnection, IntegrationCredentialVersion
from providers.connection_stepup import assert_admin, check_mutation
from providers.connection_vault import VaultUnavailable, unseal_version
from providers.connection_views import connection_database_qualified
from .models import DomainDNSBinding

CONSENT_VERSION = "dns-read-v1"
NO_CACHE = {"Cache-Control": "private, no-store"}
UUID_PATTERN = re.compile(r"[0-9a-fA-F-]{36}\Z")
AUTH_REF = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:/ -]{15,159}\Z")


def _customer(request, domain):
    if (not request.user.is_active or request.user.role != "client" or
            request.user.pk != domain.client_id):
        raise PermissionDenied("This domain is not available in your account.")


def _admin(request):
    assert_admin(request.user)


def _vault_read_ready():
    if not (getattr(settings, "CLOUD_PROVIDER_CUSTODY_VERIFIED", False) and
            getattr(settings, "CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED", False) and
            connection_database_qualified()):
        raise VaultUnavailable()


def _conn(row, expected_version):
    if (row.adapter_key != "cloudflare-dns" or row.environment != "live" or
            row.state != "draft" or row.current_version != expected_version):
        raise VaultUnavailable()
    account_id = row.public_settings.get("account_id")
    zone_id = row.public_settings.get("zone_id")
    if not isinstance(account_id, str) or not isinstance(zone_id, str):
        raise VaultUnavailable()
    try:
        require_id(account_id)
        require_id(zone_id)
        verify_chain(row)
        credential = IntegrationCredentialVersion.objects.select_related("connection").get(
            connection=row, version=expected_version, revoked_at__isnull=True
        )
        secrets = unseal_version(credential)
        return CloudflareINT01(account_id, FixedCloudflareTransport(secrets["api_token"]))
    except (CloudflareINT01Denied, IntegrationCredentialVersion.DoesNotExist,
            KeyError, DatabaseError, TypeError, ValueError) as exc:
        raise VaultUnavailable() from exc


def _record(action, actor, binding):
    # No secrets or client authorization artefacts in generic audit details.
    AuditLog.objects.create(
        actor=actor, action=action, entity_type="DomainDNSBinding",
        entity_id=str(binding.pk), entity_name="Customer DNS read-only consent",
        details={"domain_id": binding.domain_id, "state": binding.state,
                 "read_only": True, "execution_enabled": False},
    )


def status(request, domain):
    if request.user.role != "client":
        _admin(request)
    else:
        _customer(request, domain)
    binding = DomainDNSBinding.objects.filter(domain=domain).first()
    state = "not_connected"
    if binding:
        if binding.state == DomainDNSBinding.State.REVOKED:
            state = "revoked"
        elif binding.consented_at is None:
            state = "awaiting_customer_approval"
        elif binding.state != DomainDNSBinding.State.ACTIVE:
            state = "awaiting_octalve_approval"
        else:
            state = "connected"  # status only, not live provider proof
    return Response({
        "domain": domain.domain_name, "state": state, "consent_version": CONSENT_VERSION,
        "read_only": True, "records": [], "execution_enabled": False,
    }, headers=NO_CACHE)


def prepare(request, domain):
    _admin(request)
    data = request.data
    if not isinstance(data, dict) or set(data) != {
        "connection_id", "authorization_reference", "confirm_password", "totp_code"
    }:
        raise ValidationError({"detail": "Enter the approved account, ownership reference and verification."})
    connection_id = data.get("connection_id")
    reference = data.get("authorization_reference")
    if not isinstance(connection_id, str) or not UUID_PATTERN.fullmatch(connection_id):
        raise ValidationError({"connection_id": "Choose a valid saved Cloudflare connection."})
    if not isinstance(reference, str) or not AUTH_REF.fullmatch(reference):
        raise ValidationError({"authorization_reference": "Enter a documented customer-authorization reference (16-160 characters)."})
    _vault_read_ready()
    check_mutation(request.user, data["confirm_password"], data["totp_code"])
    try:
        connection = IntegrationConnection.objects.get(
            pk=uuid.UUID(connection_id), adapter_key="cloudflare-dns",
            environment="live", state="draft"
        )
    except IntegrationConnection.DoesNotExist:
        return Response({"detail": "Cloudflare connection not available."}, status=404, headers=NO_CACHE)
    connector = _conn(connection, connection.current_version)
    zone_id = connection.public_settings["zone_id"]
    try:
        connector.dns_live_inventory(zone_id, domain.domain_name)
    except CloudflareINT01Denied:
        return Response({"detail": "The Cloudflare zone could not be matched to this customer domain."},
                        status=503, headers=NO_CACHE)
    try:
        with transaction.atomic():
            locked = IntegrationConnection.objects.select_for_update().get(pk=connection.pk)
            if (locked.state != "draft" or locked.current_version != connection.current_version or
                    locked.public_settings != connection.public_settings):
                return Response({"detail": "The provider account changed. Please verify it again."},
                                status=409, headers=NO_CACHE)
            existing = DomainDNSBinding.objects.select_for_update().filter(domain=domain).first()
            if existing and existing.state != DomainDNSBinding.State.REVOKED:
                return Response({"detail": "This domain already has a pending or approved DNS connection."},
                                status=409, headers=NO_CACHE)
            if existing:
                existing.connection = locked
                existing.zone_id = zone_id
                existing.zone_name = domain.domain_name
                existing.credential_version = locked.current_version
                existing.state = DomainDNSBinding.State.PENDING
                existing.customer_authorization_reference = reference
                existing.consented_at = None
                existing.approved_at = None
                existing.approved_by = None
                existing.requested_by = request.user
                existing.save()
                binding = existing
            else:
                binding = DomainDNSBinding.objects.create(
                    domain=domain, connection=locked, zone_id=zone_id,
                    zone_name=domain.domain_name, credential_version=locked.current_version,
                    customer_authorization_reference=reference, requested_by=request.user
                )
            _record("domain_dns_prepared", request.user, binding)
    except IntegrityError:
        return Response({"detail": "This Cloudflare zone already belongs to another domain."},
                        status=409, headers=NO_CACHE)
    return Response({"state": "awaiting_customer_approval", "domain": domain.domain_name,
                     "read_only": True, "execution_enabled": False},
                    status=201, headers=NO_CACHE)


def consent(request, domain):
    _customer(request, domain)
    if not isinstance(request.data, dict) or request.data != {
        "accept": True, "consent_version": CONSENT_VERSION
    }:
        raise ValidationError({"detail": "Please confirm read-only DNS access for your domain."})
    with transaction.atomic():
        binding = DomainDNSBinding.objects.select_for_update().filter(domain=domain).first()
        if not binding or binding.state != DomainDNSBinding.State.PENDING:
            return Response({"detail": "DNS access has not been prepared for your domain."},
                            status=409, headers=NO_CACHE)
        if binding.consented_at is not None:
            return Response({"state": "awaiting_octalve_approval", "read_only": True},
                            headers=NO_CACHE)
        binding.consented_at = timezone.now()
        binding.save(update_fields=["consented_at", "updated_at"])
        _record("domain_dns_customer_consented", request.user, binding)
    return Response({"state": "awaiting_octalve_approval", "read_only": True},
                    headers=NO_CACHE)


def approve(request, domain):
    _admin(request)
    if not isinstance(request.data, dict) or set(request.data) != {"confirm_password", "totp_code"}:
        raise ValidationError({"detail": "Current password and authenticator code are required."})
    _vault_read_ready()
    check_mutation(request.user, request.data["confirm_password"], request.data["totp_code"])
    try:
        binding = DomainDNSBinding.objects.select_related("connection").get(domain=domain)
    except DomainDNSBinding.DoesNotExist:
        return Response({"detail": "No DNS connection prepared."}, status=404, headers=NO_CACHE)
    if (binding.state != DomainDNSBinding.State.PENDING or not binding.consented_at or
            binding.zone_name != domain.domain_name):
        return Response({"detail": "Customer authorization is missing or not pending."}, status=409,
                        headers=NO_CACHE)
    _vault_read_ready()
    connector = _conn(binding.connection, binding.credential_version)
    if binding.connection.public_settings.get("zone_id") != binding.zone_id:
        raise VaultUnavailable()
    try:
        connector.dns_live_inventory(binding.zone_id, binding.zone_name)
    except CloudflareINT01Denied:
        return Response({"detail": "Current DNS zone ownership could not be confirmed."},
                        status=503, headers=NO_CACHE)
    with transaction.atomic():
        locked = DomainDNSBinding.objects.select_for_update().select_related("connection").get(pk=binding.pk)
        if (locked.state != DomainDNSBinding.State.PENDING or not locked.consented_at or
                locked.zone_id != binding.zone_id or
                locked.connection.current_version != locked.credential_version or
                locked.connection.state != "draft"):
            return Response({"detail": "DNS authorization changed. Please verify again."},
                            status=409, headers=NO_CACHE)
        locked.state = DomainDNSBinding.State.ACTIVE
        locked.approved_at = timezone.now()
        locked.approved_by = request.user
        locked.save(update_fields=["state", "approved_at", "approved_by", "updated_at"])
        _record("domain_dns_approved", request.user, locked)
    return Response({"domain": domain.domain_name, "state": "connected", "read_only": True,
                     "execution_enabled": False}, headers=NO_CACHE)


def revoke(request, domain):
    _customer(request, domain)
    if not isinstance(request.data, dict) or request.data:
        raise ValidationError({"detail": "No extra fields are accepted."})
    with transaction.atomic():
        binding = DomainDNSBinding.objects.select_for_update().filter(domain=domain).first()
        if not binding:
            return Response({"state": "not_connected", "read_only": True}, headers=NO_CACHE)
        if binding.state != DomainDNSBinding.State.REVOKED:
            binding.state = DomainDNSBinding.State.REVOKED
            binding.consented_at = None
            binding.approved_at = None
            binding.approved_by = None
            binding.save(update_fields=["state", "consented_at", "approved_at", "approved_by", "updated_at"])
            _record("domain_dns_revoked", request.user, binding)
    return Response({"state": "revoked", "read_only": True}, headers=NO_CACHE)


def live_inventory(request, domain):
    if request.user.role != "client":
        _admin(request)
    else:
        _customer(request, domain)
    binding = DomainDNSBinding.objects.select_related("connection").filter(domain=domain).first()
    if not binding or binding.state != DomainDNSBinding.State.ACTIVE:
        # Status is not provider verification. No legacy/stored DNS rows are returned.
        return status(request, domain)
    if (not binding.consented_at or not binding.approved_at or
            binding.consent_version != CONSENT_VERSION or
            binding.zone_name != domain.domain_name or
            binding.connection.public_settings.get("zone_id") != binding.zone_id or
            domain.status != "active"):
        return Response({"detail": "DNS access must be verified again.", "state": "unavailable"},
                        status=503, headers=NO_CACHE)
    try:
        retry = spend_durable_auth_attempt(
            "dns:live_inventory", f"{request.user.pk}:{domain.pk}", 6, 60
        )
    except DatabaseError:
        raise VaultUnavailable()
    if retry:
        raise Throttled(wait=retry)
    _vault_read_ready()
    try:
        connector = _conn(binding.connection, binding.credential_version)
        snapshot = connector.dns_live_inventory(binding.zone_id, binding.zone_name)
    except (CloudflareINT01Denied, VaultUnavailable, DatabaseError):
        return Response({"detail": "Live DNS records are temporarily unavailable.",
                         "state": "unavailable", "records": []},
                        status=503, headers=NO_CACHE)
    return Response({
        "state": "connected", "domain": domain.domain_name,
        "read_only": True, "execution_enabled": False,
        "checked_at": timezone.now().isoformat(), **snapshot
    }, headers=NO_CACHE)
