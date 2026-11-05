"""B1 draft connection authority. No vendor HTTP or service provisioning."""
import os
import re
from django.conf import settings
from django.db import transaction, DatabaseError
from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle
from rest_framework.exceptions import PermissionDenied, ValidationError, Throttled

from catalog.permissions import InternalSupplierAuthority
from .connection_models import IntegrationConnection, IntegrationCredentialVersion, IntegrationConnectionEvent
from .connection_specs import SCHEMAS, public_catalog, validate_public_settings, validate_secrets
from .connection_vault import seal, vault, VaultUnavailable
from .connection_stepup import check_mutation, assert_admin
from .connection_audit import audit_key,append_event
from accounts.security_throttle import _spend as spend_durable_auth_attempt

class VaultMutationThrottle(BaseThrottle):
    """Cross-instance PostgreSQL security throttle, never process-local DRF cache."""
    def allow_request(self, request, view):
        if request.method=="GET":
            return True
        user=request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        try:
            # Shared by enrollment, confirmation, draft creation, rotation,
            # and revocation; the same account cannot circumvent the ceiling.
            retry=spend_durable_auth_attempt(
                "provider:vault_sensitive_action",str(user.pk),10,3600)
        except DatabaseError as exc:
            # Without the shared ledger, we cannot assert rate enforcement.
            raise VaultUnavailable() from exc
        if retry:
            raise Throttled(wait=retry)
        return True

def approved_draft_adapters():
    """Exactly the individually approved adapters; malformed settings disable all."""
    raw=getattr(settings,"CLOUD_PROVIDER_ALLOWED_DRAFT_ADAPTERS","")
    if not isinstance(raw,str) or not raw or len(raw)>512:
        return frozenset()
    parts=raw.split(",")
    if (len(parts)>len(SCHEMAS) or len(set(parts))!=len(parts)
            or any(not re.fullmatch(r"[a-z0-9_-]{2,40}",part)
                   or part not in SCHEMAS for part in parts)):
        return frozenset()
    return frozenset(parts)


def require_adapter_intake(adapter):
    # Synthetic local test harnesses may exercise every code-owned draft schema.
    # Deployed environments never get this exception.
    synthetic=(getattr(settings,"DEBUG",False)
               and getattr(settings,"CLOUD_PROVIDER_SYNTHETIC_REVIEW_WRITES_ENABLED",False)
               and os.getenv("VERCEL","")!="1"
               and os.getenv("VERCEL_ENV","").lower() not in ("production","preview","development"))
    if not synthetic and adapter not in approved_draft_adapters():
        raise VaultUnavailable()


def require_write_authority(request):
    """Portable, fail-closed secure credential storage, never supplier execution.

    Production: explicitly qualified bootstrap KEK, dedicated audit + TOTP
    keys, verified PostgreSQL migration, authorized Super Admin/password/TOTP.
    Existing isolated DEBUG synthetic-review contract is preserved for CI.
    """
    if not getattr(settings,"CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED",False):
        raise VaultUnavailable()
    synthetic=bool(
        getattr(settings,"DEBUG",False) and
        getattr(settings,"CLOUD_PROVIDER_SYNTHETIC_REVIEW_WRITES_ENABLED",False) and
        os.getenv("VERCEL_ENV","").lower() not in ("production","preview","development") and
        os.getenv("VERCEL","")!="1"
    )
    production=bool(
        not getattr(settings,"DEBUG",False) and
        getattr(settings,"CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED",False) and
        getattr(settings,"CLOUD_PROVIDER_CUSTODY_VERIFIED",False) and
        connection_database_qualified()
    )
    if not (synthetic or production):
        raise VaultUnavailable()
    user=request.user
    assert_admin(user)
    password=request.data.get("confirm_password")
    if not isinstance(password,str) or len(password)>512 or not user.check_password(password):
        raise PermissionDenied("Recent account password verification is required.")
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,32}",getattr(settings,"CLOUD_PROVIDER_VAULT_KEY_ID","")):
        raise VaultUnavailable()
    vault()
    audit_key()
    check_mutation(user,password,request.data.get("totp_code"))


def connection_database_qualified():
    """Never write vault ciphertext into a database without schema and audit guard.

    Separate operator evidence (migrations, key backup and restore) is still
    necessary; the database check only tests current technical capability.
    """
    from django.db import connection
    if connection.vendor!="postgresql":
        return False
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) FROM django_migrations
                WHERE app='providers' AND name IN (
                  '0002_integration_draft_vault',
                  '0003_provider_vault_authenticator',
                  '0004_provider_event_integrity'
                )
            """)
            if cursor.fetchone()[0]!=3: return False
            cursor.execute("""
                SELECT COUNT(*) FROM pg_trigger
                WHERE tgrelid='providers_integrationconnectionevent'::regclass
                  AND tgname='providers_event_append_only' AND NOT tgisinternal
                  AND tgenabled IN ('O', 'A')
            """)
            return cursor.fetchone()[0]==1
    except DatabaseError:
        return False

def clean_payload(data, expected):
    if not isinstance(data,dict) or set(data)!=expected:
        raise ValidationError({"detail":"Only documented connection fields are accepted."})
    return data

def safe_connection(row):
    return {
        "id":str(row.pk),"adapter_key":row.adapter_key,"label":row.label,
        "environment":row.environment,"public_settings":row.public_settings,
        "state":row.state,"credential_configured":row.state=="draft",
        "credential_version":row.current_version,
        "created_at":row.created_at.isoformat(),
        "updated_at":row.updated_at.isoformat(),
        "execution_enabled":False,
    }

@api_view(["GET"])
@permission_classes([InternalSupplierAuthority])
def connection_schemas(request):
    assert_admin(request.user)
    return Response({"integrations":public_catalog(),"execution_enabled":False})

@api_view(["GET","POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def connections(request):
    assert_admin(request.user)
    if request.method=="GET":
        try:
            rows=list(IntegrationConnection.objects.order_by("-created_at","pk")[:51])
        except (OperationalError, ProgrammingError):
            return Response({"detail":"Connection registry is not available yet."},status=503)
        return Response({"results":[safe_connection(x) for x in rows[:50]],
                         "truncated":len(rows)>50,"execution_enabled":False})
    require_write_authority(request)
    data=clean_payload(request.data,{"adapter_key","label","environment","public_settings","secrets","confirm_password","totp_code"})
    adapter=data["adapter_key"]
    if adapter not in SCHEMAS:
        raise ValidationError({"adapter_key":"Adapter is not supported for secure draft storage."})
    require_adapter_intake(adapter)
    label=data["label"]
    if not isinstance(label,str) or not 2<=len(label)<=120 or label!=label.strip():
        raise ValidationError({"label":"Enter a descriptive connection name."})
    if data["environment"] not in ("test","live"):
        raise ValidationError({"environment":"Choose test or live."})
    public=validate_public_settings(adapter,data["public_settings"])
    secrets=validate_secrets(adapter,data["secrets"])
    with transaction.atomic():
        row=IntegrationConnection.objects.create(adapter_key=adapter,label=label,
            environment=data["environment"],public_settings=public,
            state="draft",current_version=1,created_by=request.user)
        IntegrationCredentialVersion.objects.create(connection=row,version=1,
            key_id=settings.CLOUD_PROVIDER_VAULT_KEY_ID,ciphertext=seal(adapter,row.pk,1,secrets))
        append_event(row,request.user,"draft_created",1)
    return Response(safe_connection(row),status=status.HTTP_201_CREATED,
                    headers={"Cache-Control":"no-store"})

@api_view(["GET"])
@permission_classes([InternalSupplierAuthority])
def connection_detail(request, connection_id):
    assert_admin(request.user)
    try:
        row=IntegrationConnection.objects.get(pk=connection_id)
    except IntegrationConnection.DoesNotExist:
        return Response({"detail":"Connection not found."},status=404)
    except (OperationalError, ProgrammingError):
        return Response({"detail":"Connection registry is not available yet."},status=503)
    return Response(safe_connection(row),headers={"Cache-Control":"no-store"})

@api_view(["POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def rotate_connection(request, connection_id):
    require_write_authority(request)
    data=clean_payload(request.data,{"secrets","confirm_password","totp_code"})
    with transaction.atomic():
        try:
            row=IntegrationConnection.objects.select_for_update().get(pk=connection_id)
        except IntegrationConnection.DoesNotExist:
            return Response({"detail":"Connection not found."},status=404)
        if row.state!="draft":
            return Response({"detail":"Revoked connection cannot be rotated."},status=409)
        require_adapter_intake(row.adapter_key)
        secrets=validate_secrets(row.adapter_key,data["secrets"])
        next_version=row.current_version+1
        if next_version>65535:
            raise ValidationError({"detail":"Maximum credential versions reached."})
        encrypted=seal(row.adapter_key,row.pk,next_version,secrets)
        old=IntegrationCredentialVersion.objects.select_for_update().get(connection=row,version=row.current_version)
        old.revoked_at=timezone.now()
        old.save(update_fields=["revoked_at"])
        IntegrationCredentialVersion.objects.create(connection=row,version=next_version,
            key_id=settings.CLOUD_PROVIDER_VAULT_KEY_ID,ciphertext=encrypted)
        row.current_version=next_version
        row.save(update_fields=["current_version","updated_at"])
        append_event(row,request.user,"credential_rotated",next_version)
    return Response(safe_connection(row),headers={"Cache-Control":"no-store"})

@api_view(["POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def revoke_connection(request, connection_id):
    require_write_authority(request)
    clean_payload(request.data,{"confirm_password","totp_code"})
    with transaction.atomic():
        try:
            row=IntegrationConnection.objects.select_for_update().get(pk=connection_id)
        except IntegrationConnection.DoesNotExist:
            return Response({"detail":"Connection not found."},status=404)
        if row.state=="revoked":
            return Response({"detail":"Connection already revoked."},status=409)
        now=timezone.now()
        IntegrationCredentialVersion.objects.filter(connection=row,revoked_at__isnull=True).update(revoked_at=now)
        row.state="revoked"
        row.save(update_fields=["state","updated_at"])
        append_event(row,request.user,"credential_revoked",row.current_version)
    return Response(safe_connection(row),headers={"Cache-Control":"no-store"})
