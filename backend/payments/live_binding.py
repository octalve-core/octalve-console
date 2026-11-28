"""Separate live Paystack authority, bound to the existing integration vault."""
import hashlib
import hmac
import json
import uuid
from django.conf import settings
from django.db import transaction,DatabaseError
from django.views.decorators.debug import sensitive_variables
from rest_framework.decorators import api_view,permission_classes,throttle_classes
from rest_framework.exceptions import PermissionDenied,ValidationError
from rest_framework.response import Response
from audit.models import AuditLog
from catalog.permissions import InternalSupplierAuthority
from providers.connection_audit import audit_keyring,verify_chain
from providers.connection_models import IntegrationConnection,IntegrationCredentialVersion
from providers.connection_status import verification_receipts,safe_verification_status
from providers.connection_stepup import assert_admin,check_mutation
from providers.connection_views import VaultMutationThrottle
from providers.connection_vault import VaultUnavailable,unseal_version
from providers.connection_verification import paystack_readback,ProviderReadbackFailed
from providers.hosting_runtime import qualified_vault
from .models import PaymentGateway,PaymentIntent,WebhookEvent
from .vault_binding import SOURCE_KEY,VERSION_KEY

ACTION="paystack_live_binding_v1"
HEADERS={"Cache-Control":"private, no-store"}

def enabled():
    return bool(getattr(settings,"CLOUD_PAYSTACK_LIVE_BINDING_ENABLED",False)
        and getattr(settings,"CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED",False) and qualified_vault())

def identity(row):
    return {"connection":str(row.pk),"version":row.current_version,
            "updated":row.updated_at.isoformat(),"audit_head":row.audit_head,
            "adapter":row.adapter_key,"environment":row.environment}

def _mac(payload,key):
    return hmac.new(key,b"octalve-paystack-live-v1\0"+json.dumps(payload,sort_keys=True,separators=(",",":")).encode(),hashlib.sha256).hexdigest()

@sensitive_variables("secret")
def _key(row):
    if row.adapter_key!="paystack" or row.environment!="live" or row.state!="draft":
        raise VaultUnavailable()
    verify_chain(row)
    version=IntegrationCredentialVersion.objects.select_related("connection").get(connection=row,version=row.current_version,revoked_at__isnull=True)
    secret=unseal_version(version).get("secret_key")
    if not isinstance(secret,str) or not secret.startswith("sk_live_") or len(secret)<24:
        raise VaultUnavailable()
    return secret

def approved(gateway,row):
    grant=AuditLog.objects.filter(action=ACTION,entity_type="PaymentGateway",entity_id=str(gateway.pk)).order_by("-pk").first()
    if not grant:
        return False
    try:
        payload=grant.details["payload"]
        _,keys=audit_keyring()
        return (payload=={"gateway":gateway.pk,**identity(row)} and hmac.compare_digest(grant.details["mac"],_mac(payload,keys[grant.details["key_id"]])))
    except (KeyError,TypeError,ValueError,VaultUnavailable):
        return False

@sensitive_variables()
def resolve_live_key(gateway):
    try:
        if (not enabled() or gateway.code!="paystack" or gateway.test_mode or gateway.status!="active"
                or gateway.encrypted_secret_key or gateway.encrypted_webhook_secret
                or set(gateway.config)!={SOURCE_KEY,VERSION_KEY}):
            return None
        row=IntegrationConnection.objects.get(pk=uuid.UUID(gateway.config[SOURCE_KEY]))
        if row.current_version!=gateway.config[VERSION_KEY] or not approved(gateway,row):
            return None
        return _key(row)
    except (VaultUnavailable,DatabaseError,ValueError,TypeError,KeyError,
            IntegrationConnection.DoesNotExist,IntegrationCredentialVersion.DoesNotExist):
        return None

@api_view(["GET","POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
@sensitive_variables("secret","data")
def admin_live_binding(request):
    assert_admin(request.user)
    allowed=enabled()
    gateway=PaymentGateway.objects.filter(code="paystack").first()
    if request.method=="GET":
        rows=list(IntegrationConnection.objects.filter(adapter_key="paystack",environment="live",state="draft").order_by("-created_at")[:51])
        receipts=verification_receipts(rows[:50])
        return Response({"binding_available":allowed,"connections":[{"id":str(x.pk),"label":x.label,"credential_version":x.current_version,**safe_verification_status(x,receipts)} for x in rows[:50]],
            "truncated":len(rows)>50,"gateway_state":"live_bound" if gateway and resolve_live_key(gateway) else "not_bound"},headers=HEADERS)
    if not allowed:
        raise VaultUnavailable()
    data=request.data
    if not isinstance(data,dict) or set(data)!={"connection_id","confirm_password","totp_code","accept_live"} or data["accept_live"] is not True:
        raise ValidationError("Confirm the live gateway binding.")
    check_mutation(request.user,data["confirm_password"],data["totp_code"])
    try:
        row=IntegrationConnection.objects.get(pk=uuid.UUID(data["connection_id"]))
        secret=_key(row)
        expected=identity(row)
        proof=paystack_readback(secret,"live")
        if not (proof.get("authenticated") is True and proof.get("environment")=="live" and proof.get("read_only") is True and proof.get("payment_collection_enabled") is False):
            raise VaultUnavailable()
        with transaction.atomic():
            row=IntegrationConnection.objects.select_for_update().get(pk=row.pk)
            if identity(row)!=expected or _key(row)!=secret:
                raise VaultUnavailable()
            gateway=PaymentGateway.objects.select_for_update().filter(code="paystack").first()
            if gateway:
                if gateway.encrypted_secret_key or gateway.encrypted_webhook_secret:
                    raise PermissionDenied("Existing legacy gateway requires separate reconciliation.")
                if PaymentIntent.objects.filter(gateway=gateway,status__in=("pending","processing")).exists() or WebhookEvent.objects.filter(gateway=gateway,is_verified=True,is_processed=False).exists():
                    raise PermissionDenied("Resolve outstanding payment intents and signed events before changing gateway authority.")
                if not gateway.test_mode and gateway.config.get(SOURCE_KEY)!=str(row.pk):
                    raise PermissionDenied("A different live gateway requires a separately reviewed migration.")
            else:
                gateway=PaymentGateway(code="paystack")
            gateway.name="Paystack"
            gateway.status="active"
            gateway.test_mode=False
            gateway.encrypted_secret_key=None
            gateway.encrypted_webhook_secret=None
            gateway.config={SOURCE_KEY:str(row.pk),VERSION_KEY:row.current_version}
            gateway.save()
            payload={"gateway":gateway.pk,**identity(row)}
            active,keys=audit_keyring()
            AuditLog.objects.create(actor=request.user,action=ACTION,entity_type="PaymentGateway",entity_id=str(gateway.pk),entity_name="paystack",
                details={"payload":payload,"key_id":active,"mac":_mac(payload,keys[active])})
    except (IntegrationConnection.DoesNotExist,IntegrationCredentialVersion.DoesNotExist,ProviderReadbackFailed,ValueError,TypeError,KeyError):
        raise ValidationError("Live Paystack authority could not be verified.") from None
    return Response({"gateway_state":"live_bound","binding_version":row.current_version},headers=HEADERS)
