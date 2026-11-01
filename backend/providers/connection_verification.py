"""INT-02 server-only supplier credential readback. NO supplier mutations.

Only reviewed adapter keys can be verified, each with a code-owned fixed
origin. Decrypted credentials never appear in a browser response or logs.
"""
import json

import requests
from django.db import DatabaseError,transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied,ValidationError
from rest_framework.response import Response

from catalog.permissions import InternalSupplierAuthority
from .connection_audit import verify_chain
from .connection_models import IntegrationConnection,IntegrationCredentialVersion
from .connection_stepup import assert_admin,check_mutation
from .connection_views import VaultMutationThrottle, connection_database_qualified
from .connection_vault import VaultUnavailable,unseal_version
from .cloudflare_int01 import CloudflareINT01, FixedCloudflareTransport, CloudflareINT01Denied
from audit.models import AuditLog

class ProviderReadbackFailed(ValueError):
    def __str__(self):
        return "Provider credential verification could not be completed."

def brevo_readback(api_key):
    """Credential validation only. Does not send mail or disclose account data."""
    if not isinstance(api_key,str) or len(api_key)<12:
        raise ProviderReadbackFailed()
    session=requests.Session()
    session.trust_env=False
    session.headers.clear()
    try:
        response=session.get("https://api.brevo.com/v3/account",
            headers={"api-key":api_key,"Accept":"application/json"},
            timeout=(3,8),verify=True,allow_redirects=False,stream=True)
        with response:
            if response.status_code!=200: raise ProviderReadbackFailed()
            result=bytearray()
            for chunk in response.iter_content(chunk_size=8192):
                result.extend(chunk)
                if len(result)>65536: raise ProviderReadbackFailed()
            obj=json.loads(bytes(result).decode("utf-8"))
            # One documented account identifier is needed, but never returned.
            if not isinstance(obj,dict) or not isinstance(obj.get("email"),str) or "@" not in obj["email"]:
                raise ProviderReadbackFailed()
            return {"authenticated":True,"delivery_enabled":False,"read_only":True}
    except (requests.RequestException,ValueError,UnicodeError) as exc:
        raise ProviderReadbackFailed() from exc
    finally:
        session.close()

@api_view(["POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def verify_connection(request,connection_id):
    assert_admin(request.user)
    if set(request.data)!={"confirm_password","totp_code"}:
        raise ValidationError({"detail":"Only password and authenticator code are accepted."})
    # This is not an alternate secret-entry path. It works only with
    # independently qualified encrypted database storage and key custody.
    from django.conf import settings
    if not (settings.CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED and
            settings.CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED and
            settings.CLOUD_PROVIDER_CUSTODY_VERIFIED and
            not settings.DEBUG and connection_database_qualified()):
        raise VaultUnavailable()
    check_mutation(request.user,request.data["confirm_password"],request.data["totp_code"])
    try:
        row=IntegrationConnection.objects.get(pk=connection_id,state="draft")
    except IntegrationConnection.DoesNotExist:
        return Response({"detail":"Connection draft not found."},status=404)
    if row.adapter_key not in ("cloudflare-dns","cloudflare-registrar","brevo"):
        return Response({"detail":"A certified read-only verification adapter is not yet available."},status=409)
    try:
        verify_chain(row)
        version=IntegrationCredentialVersion.objects.select_related("connection").get(
            connection=row,version=row.current_version,revoked_at__isnull=True)
        secrets=unseal_version(version)
        if row.adapter_key=="cloudflare-dns":
            connector=CloudflareINT01(row.public_settings["account_id"],
                FixedCloudflareTransport(secrets["api_token"]))
            proof=connector.dns_readback(row.public_settings["zone_id"])
        elif row.adapter_key=="cloudflare-registrar":
            connector=CloudflareINT01(row.public_settings["account_id"],
                FixedCloudflareTransport(secrets["api_token"]))
            proof=connector.sandbox_readback()
        else:
            proof=brevo_readback(secrets["api_key"])
    except (CloudflareINT01Denied,ProviderReadbackFailed,VaultUnavailable,
            IntegrationCredentialVersion.DoesNotExist,KeyError,DatabaseError):
        return Response({"verified":False,"detail":"Credential readback failed or could not be certified."},
            status=503,headers={"Cache-Control":"private, no-store"})
    try:
        AuditLog.objects.create(actor=request.user,action="provider_connection_test",
            entity_type="IntegrationConnection",entity_id=str(row.pk),
            entity_name=row.adapter_key,details={
                "adapter":row.adapter_key,"credential_version":row.current_version,
                "verified":True,"read_only":True,"execution_enabled":False,
                "checked_at":timezone.now().isoformat()})
    except DatabaseError:
        return Response({"verified":False,"detail":"Supplier readback succeeded but its audit receipt failed."},
            status=503,headers={"Cache-Control":"private, no-store"})
    return Response({"verified":True,"adapter_key":row.adapter_key,
        "credential_version":row.current_version,"execution_enabled":False,
        "checked_at":timezone.now().isoformat(),"evidence":proof},
        headers={"Cache-Control":"private, no-store"})
