"""Explicit version-bound registration authority in the existing Integration Store."""
import hashlib
import hmac
import json
from uuid import UUID
from django.db import transaction,DatabaseError
from django.conf import settings
from rest_framework.decorators import api_view,permission_classes,throttle_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from audit.models import AuditLog
from catalog.permissions import InternalSupplierAuthority
from .connection_audit import audit_keyring,verify_chain
from .connection_models import IntegrationConnection,IntegrationCredentialVersion
from .connection_status import verification_receipts,safe_verification_status
from .connection_stepup import assert_admin,check_mutation
from .connection_views import VaultMutationThrottle
from .connection_vault import VaultUnavailable,unseal_version
from .hosting_runtime import qualified_vault
from .cloudflare_int01 import CloudflareINT01,FixedCloudflareTransport,CloudflareINT01Denied

ACTION="registrar_live_registration_policy_v1"

def ready():
    return bool(qualified_vault() and settings.CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED
        and settings.CLOUD_REGISTRAR_LIVE_QUOTE_READBACK_ENABLED)

def identity(row):
    return {"connection_id":str(row.pk),"credential_version":row.current_version,
        "adapter":row.adapter_key,"environment":row.environment,"settings":row.public_settings,
        "updated_at":row.updated_at.isoformat(),"audit_head":row.audit_head}

def mac(payload,key):
    return hmac.new(key,b"octalve-registrar-live-v1\0"+json.dumps(payload,sort_keys=True,separators=(",",":")).encode(),
        hashlib.sha256).hexdigest()

def token(row):
    if row.state!="draft" or row.adapter_key!="cloudflare-registrar-live" or row.environment!="live":
        raise VaultUnavailable()
    verify_chain(row)
    version=IntegrationCredentialVersion.objects.get(connection=row,version=row.current_version,revoked_at__isnull=True)
    return unseal_version(version)["api_token"]

def approved(row):
    grant=AuditLog.objects.filter(action=ACTION,entity_type="IntegrationConnection",entity_id=str(row.pk)).order_by("-pk").first()
    if not grant:
        return False
    try:
        payload=grant.details["payload"]
        _,keys=audit_keyring()
        return (payload=={**identity(row),"registration":True,"dedicated_account":True}
            and hmac.compare_digest(grant.details["mac"],mac(payload,keys[grant.details["key_id"]])))
    except (KeyError,TypeError,ValueError,VaultUnavailable):
        return False

def load(route):
    if not ready() or not isinstance(route,dict) or type(route.get("credential_version")) is not int:
        raise VaultUnavailable()
    row=IntegrationConnection.objects.get(pk=UUID(route["connection_id"]),current_version=route["credential_version"])
    if not approved(row):
        raise VaultUnavailable()
    return row,token(row)

@api_view(["GET","POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def configure(request,connection_id):
    assert_admin(request.user)
    row=IntegrationConnection.objects.filter(pk=connection_id,state="draft",adapter_key="cloudflare-registrar-live",environment="live").first()
    if not row:
        raise ValidationError("Live registrar connection unavailable.")
    headers={"Cache-Control":"private, no-store"}
    if request.method=="GET":
        return Response({"available":ready(),"registration_enabled":bool(ready() and approved(row)),
            "supported_tlds":[".com",".net"],"manual_renewal":False,"custom_nameservers":False,
            "contact_updates":False,"transfer_execution":False},headers=headers)
    data=request.data
    if not ready() or not isinstance(data,dict) or set(data)!={"confirm_password","totp_code","registration","dedicated_account"} or type(data["registration"]) is not bool or data["dedicated_account"] is not True:
        raise ValidationError("Confirm the dedicated registrar account and registration policy.")
    check_mutation(request.user,data["confirm_password"],data["totp_code"])
    expected=identity(row)
    try:
        if data["registration"]:
            secret=token(row)
            CloudflareINT01(row.public_settings["account_id"],FixedCloudflareTransport(secret)).live_domain_check("example.com")
        with transaction.atomic():
            row=IntegrationConnection.objects.select_for_update().get(pk=row.pk)
            if identity(row)!=expected or row.state!="draft":
                raise VaultUnavailable()
            token(row)
            payload={**identity(row),"registration":data["registration"],"dedicated_account":True}
            active,keys=audit_keyring()
            AuditLog.objects.create(actor=request.user,action=ACTION,entity_type="IntegrationConnection",entity_id=str(row.pk),
                entity_name="Live registrar execution policy",details={"payload":payload,"key_id":active,"mac":mac(payload,keys[active])})
    except (CloudflareINT01Denied,VaultUnavailable,DatabaseError,KeyError,IntegrationConnection.DoesNotExist,IntegrationCredentialVersion.DoesNotExist):
        raise ValidationError("Registrar policy could not be verified.") from None
    return Response({"registration_enabled":data["registration"]},headers=headers)
