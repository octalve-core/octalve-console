"""DNS-01C: customer DNS-only onboarding against exact read-only Cloudflare zones.

This is NOT domain registration. A randomized TXT challenge demonstrates
control of a specific Cloudflare zone; it does not prove registry ownership,
public nameserver delegation, domain expiry, or commercial entitlement.
The existing Domain and DomainDNSBinding remain the sole customer authorities.
"""
import hashlib
import hmac
import re
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import DatabaseError, IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, Throttled, ValidationError
from rest_framework.response import Response

from accounts.security_throttle import _spend as spend_durable_auth_attempt
from audit.models import AuditLog
from providers.cloudflare_int01 import CloudflareINT01Denied, require_id
from providers.connection_models import IntegrationConnection
from providers.connection_stepup import assert_admin, check_mutation

from .dns_readonly import (
    CONSENT_VERSION, NO_CACHE, _conn, _release_gate, _vault_read_ready,
)
from .models import Domain, DomainDNSBinding, DomainDNSClaim
from .registrar_quote import HOSTNAME

CHALLENGE_PREFIX = "_octalve-verify."
CHALLENGE_VALUE_PREFIX = "octalve-verify="
CHALLENGE_LIFETIME = timedelta(hours=2)
PROOF_MAX_ATTEMPTS = 6


def _gated():
    _release_gate()
    if not getattr(settings, "CLOUD_DNS01_EXTERNAL_CLAIMS_ENABLED", False):
        from providers.connection_vault import VaultUnavailable
        raise VaultUnavailable()


def _client(request):
    user = request.user
    if (not user.is_authenticated or not user.is_active or user.role != "client"
            or getattr(user, "email_verified_at", None) is None):
        raise PermissionDenied("Verify your client account before connecting a domain.")


def _strict_domain(value):
    if not isinstance(value, str) or len(value) > 253:
        raise ValidationError({"domain_name": "Enter a valid domain hostname."})
    value = value.strip().lower().rstrip(".")
    if not HOSTNAME.fullmatch(value) or ".." in value or value.startswith("xn--"):
        raise ValidationError({"domain_name": "Enter a valid ASCII domain hostname."})
    return value


def _rate(user, action, max_attempts, window_seconds):
    try:
        retry = spend_durable_auth_attempt(
            "dns:external:" + action, str(user.pk), max_attempts, window_seconds
        )
    except DatabaseError as exc:
        from providers.connection_vault import VaultUnavailable
        raise VaultUnavailable() from exc
    if retry:
        raise Throttled(wait=retry)


def _public(claim):
    return {
        "id": str(claim.pk),
        "domain_name": claim.domain_name,
        "client_id": claim.client_id,
        "state": claim.state,
        "expires_at": claim.expires_at.isoformat(),
        "verified_at": claim.verified_at.isoformat() if claim.verified_at else None,
        "domain_id": claim.domain_id,
        "read_only": True,
        "registration_confirmed": False,
        "execution_enabled": False,
    }


def list_claims(request):
    _gated()
    if request.user.role == "client":
        _client(request)
        rows = DomainDNSClaim.objects.filter(client=request.user).order_by("-created_at")[:30]
    else:
        assert_admin(request.user)
        rows = DomainDNSClaim.objects.order_by("-created_at")[:50]
    return Response({"results": [_public(row) for row in rows],
                     "execution_enabled": False}, headers=NO_CACHE)


def begin_claim(request):
    _gated()
    _client(request)
    if not isinstance(request.data, dict) or set(request.data) != {"domain_name"}:
        raise ValidationError({"detail": "Enter the domain name only."})
    domain_name = _strict_domain(request.data["domain_name"])
    _rate(request.user, "issue", 5, 3600)

    raw = CHALLENGE_VALUE_PREFIX + secrets.token_urlsafe(32)
    digest = hashlib.sha256(raw.encode("ascii")).hexdigest()
    now = timezone.now()
    try:
        with transaction.atomic():
            # Unique domain name in both tables prevents dual tenancy.
            if Domain.objects.filter(domain_name=domain_name).exists():
                return Response({"detail": "This domain is already managed or has an existing claim."},
                                status=409, headers=NO_CACHE)
            claim = DomainDNSClaim.objects.select_for_update().filter(domain_name=domain_name).first()
            if (claim and claim.client_id != request.user.pk and
                    not (claim.state == DomainDNSClaim.State.PENDING and
                         claim.expires_at <= now)):
                return Response({"detail": "This domain is already managed or has an existing claim."},
                                status=409, headers=NO_CACHE)
            if claim and claim.state == DomainDNSClaim.State.VERIFIED:
                return Response({"detail": "This domain is already managed or has an existing claim."},
                                status=409, headers=NO_CACHE)
            if claim and claim.state == DomainDNSClaim.State.PENDING and (
                    claim.updated_at + timedelta(seconds=60) > now):
                return Response({"detail": "A recent challenge exists. Check your current instructions."},
                                status=409, headers=NO_CACHE)
            if claim:
                # Expired, unverified claims cannot squat on another user's
                # domain permanently. Fresh randomized proof is mandatory.
                claim.client = request.user
                claim.challenge_sha256 = digest
                claim.expires_at = now + CHALLENGE_LIFETIME
                claim.state = DomainDNSClaim.State.PENDING
                claim.verified_at = None
                claim.verified_by = None
                claim.domain = None
                claim.save()
            else:
                claim = DomainDNSClaim.objects.create(
                    client=request.user, domain_name=domain_name,
                    challenge_sha256=digest, expires_at=now + CHALLENGE_LIFETIME,
                )
            AuditLog.objects.create(
                actor=request.user, action="domain_dns_claim_started",
                entity_type="DomainDNSClaim", entity_id=str(claim.pk),
                entity_name="External DNS verification initiated",
                details={"state": "pending", "read_only": True,
                         "execution_enabled": False},
            )
    except IntegrityError:
        return Response({"detail": "This domain is already managed or has an existing claim."},
                        status=409, headers=NO_CACHE)
    # One-time plaintext display. Only its digest is stored; no logs or
    # readback endpoints may return the challenge value again.
    return Response({
        **_public(claim),
        "challenge": {
            "type": "TXT",
            "name": CHALLENGE_PREFIX + domain_name,
            "value": raw,
            "expires_at": claim.expires_at.isoformat(),
        },
        "next_step": "Add this TXT record in your Cloudflare zone, then request verification.",
    }, status=201, headers=NO_CACHE)


def _contains_exact_proof(snapshot, domain_name, expected_digest):
    if (not isinstance(snapshot, dict) or snapshot.get("zone_name") != domain_name
            or snapshot.get("read_only") is not True
            or not isinstance(snapshot.get("records"), list)):
        return False
    host = CHALLENGE_PREFIX + domain_name
    for item in snapshot["records"]:
        if not isinstance(item, dict):
            continue
        if item.get("type") != "TXT" or item.get("name") != host:
            continue
        content = item.get("value")
        if not isinstance(content, str):
            continue
        # Cloudflare represents short TXT values with or without wrapping
        # quotes depending on the API input; never relax to substring matches.
        content = content[1:-1] if len(content) >= 2 and content.startswith('"') and content.endswith('"') else content
        if (content.startswith(CHALLENGE_VALUE_PREFIX)
                and hmac.compare_digest(hashlib.sha256(content.encode("utf-8")).hexdigest(),
                                        expected_digest)):
            return True
    return False


def verify_claim(request):
    _gated()
    assert_admin(request.user)
    data = request.data
    if not isinstance(data, dict) or set(data) != {
        "claim_id", "connection_id", "confirm_password", "totp_code"
    }:
        raise ValidationError({"detail": "Choose the claim, scoped Cloudflare connection and fresh verification."})
    try:
        claim_id = uuid.UUID(str(data["claim_id"]))
        connection_id = uuid.UUID(str(data["connection_id"]))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError({"detail": "Choose valid claim and connection references."}) from None
    _rate(request.user, "verify", PROOF_MAX_ATTEMPTS, 3600)
    _vault_read_ready()
    check_mutation(request.user, data["confirm_password"], data["totp_code"])
    claim = DomainDNSClaim.objects.filter(pk=claim_id, state=DomainDNSClaim.State.PENDING).first()
    if not claim or claim.expires_at <= timezone.now():
        return Response({"detail": "Claim is unavailable or has expired."}, status=409, headers=NO_CACHE)
    connection = IntegrationConnection.objects.filter(
        pk=connection_id, adapter_key="cloudflare-dns",
        state="draft", environment="live",
    ).first()
    if not connection:
        return Response({"detail": "Saved Cloudflare connection is unavailable."}, status=404, headers=NO_CACHE)
    connector = _conn(connection, connection.current_version)
    zone_id = require_id(connection.public_settings.get("zone_id", ""))
    try:
        snapshot = connector.dns_live_inventory(zone_id, claim.domain_name)
    except CloudflareINT01Denied:
        return Response({"detail": "Unable to verify the exact Cloudflare zone."},
                        status=503, headers=NO_CACHE)
    if not _contains_exact_proof(snapshot, claim.domain_name, claim.challenge_sha256):
        return Response({"detail": "The required TXT record was not found in the verified zone."},
                        status=409, headers=NO_CACHE)
    try:
        with transaction.atomic():
            current_connection = IntegrationConnection.objects.select_for_update().get(pk=connection.pk)
            locked = DomainDNSClaim.objects.select_for_update().get(pk=claim.pk)
            if (locked.state != DomainDNSClaim.State.PENDING
                    or locked.expires_at <= timezone.now()
                    or locked.client_id != claim.client_id
                    or locked.domain_name != claim.domain_name
                    or locked.challenge_sha256 != claim.challenge_sha256
                    or current_connection.current_version != connection.current_version
                    or current_connection.state != "draft"
                    or current_connection.public_settings != connection.public_settings):
                return Response({"detail": "Claim or credential changed. Start verification again."},
                                status=409, headers=NO_CACHE)
            if Domain.objects.filter(domain_name=locked.domain_name).exists():
                return Response({"detail": "This domain already exists in Octalve Cloud."},
                                status=409, headers=NO_CACHE)
            if DomainDNSBinding.objects.filter(zone_id=zone_id).exists():
                return Response({"detail": "This zone is already bound to another domain."},
                                status=409, headers=NO_CACHE)
            # Absolutely no pretend registrar purchase/renewal/expiry!
            domain = Domain.objects.create(
                domain_name=locked.domain_name,
                tld="." + locked.domain_name.rsplit(".", 1)[-1],
                client=locked.client,
                management_kind="dns_only",
                status="dns_only",
                registration_type="dns_only",
                registration_date=None,
                expiry_date=None,
                next_due_date=None,
                auto_renew=False,
                registrar=None,
                order_item=None,
                provider_domain_id=None,
            )
            binding = DomainDNSBinding.objects.create(
                domain=domain, client=locked.client, connection=current_connection,
                zone_id=zone_id, zone_name=domain.domain_name,
                credential_version=current_connection.current_version,
                state=DomainDNSBinding.State.PENDING,
                requested_by=request.user,
                customer_authorization_reference="dnsclaim:" + str(locked.pk),
                consent_version=CONSENT_VERSION,
            )
            locked.state = DomainDNSClaim.State.VERIFIED
            locked.domain = domain
            locked.verified_by = request.user
            locked.verified_at = timezone.now()
            locked.save(update_fields=["state", "domain", "verified_by", "verified_at", "updated_at"])
            AuditLog.objects.create(
                actor=request.user, action="domain_dns_claim_verified",
                entity_type="DomainDNSClaim", entity_id=str(locked.pk),
                entity_name="External DNS zone control verified",
                details={"domain_id": domain.pk, "binding_id": binding.pk,
                         "read_only": True, "registration_confirmed": False,
                         "execution_enabled": False},
            )
    except IntegrityError:
        return Response({"detail": "Domain or Cloudflare zone was concurrently claimed."},
                        status=409, headers=NO_CACHE)
    return Response({
        **_public(locked),
        "state": "verified",
        "next_step": "Customer must approve DNS visibility, then Super Admin approves access.",
    }, headers=NO_CACHE)
