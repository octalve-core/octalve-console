"""Rebind a confirmed registrar resource to a rotated credential on the same account.

Readback-only, exact owner/resource identity. Never move resources between
accounts, re-sign an unpaid quote, or bypass an uncertain supplier operation.
"""
from django.core import signing
from django.db import transaction,DatabaseError
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.decorators import api_view,permission_classes,throttle_classes
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from audit.models import AuditLog
from catalog.permissions import InternalSupplierAuthority
from providers.connection_stepup import assert_admin,check_mutation
from providers.connection_views import VaultMutationThrottle
from providers.connection_models import IntegrationConnection,IntegrationCredentialVersion
from providers.connection_vault import VaultUnavailable
from providers.registrar_live_policy import load
from .models import Domain
from .live_registration import KEY,SALT,HEADERS,connector,digest,account_id,RegistrationRefused
from .resellerclub_lifecycle import read

def reauthorize(user,connection_id,public_id):
    domain=Domain.objects.get(public_id=public_id,management_kind="registrar")
    entry=domain.metadata[KEY];grant=signing.loads(entry["grant"],salt=SALT)
    row=IntegrationConnection.objects.get(pk=connection_id,environment="live",state="draft")
    old=grant["route"]
    if (entry.get("state")!="confirmed" or str(row.pk)!=old["connection_id"] or row.current_version<=old["credential_version"]
        or row.adapter_key!=domain.registrar or account_id(row)!=grant["account_id"] or not domain.provider_domain_id
        or domain.client_id!=grant["owner"] or domain.domain_name!=grant["domain"] or domain.order_item_id!=grant["item"]
        or domain.order_item.order_id!=grant["order"] or digest(domain.registrant_contact)!=grant["contact_digest"]
        or any(domain.metadata.get(k,{}).get("state") in ("queued","uncertain") for k in ("registrar_renewal_v1","registrar_nameserver_change_v1","registrar_protection_change_v1"))):
        raise RegistrationRefused()
    new={**old,"credential_version":row.current_version}
    current,secret,adapter=connector(new)
    if current.pk!=row.pk:raise RegistrationRefused()
    if row.adapter_key=="resellerclub":
        proof=read(domain,entry,adapter)
    elif row.adapter_key=="cloudflare-registrar-live":
        proof=adapter.live_registration_readback(domain.domain_name)
        if domain.provider_domain_id!=domain.domain_name or proof.get("domain_name")!=domain.domain_name or parse_datetime(proof["registered_at"])!=domain.registration_date:
            raise RegistrationRefused()
    else:raise RegistrationRefused()
    if parse_datetime(proof["expires_at"])!=domain.expiry_date:raise RegistrationRefused()
    with transaction.atomic():
        locked=Domain.objects.select_for_update().get(pk=domain.pk)
        IntegrationConnection.objects.select_for_update().get(pk=row.pk)
        if locked.metadata!=domain.metadata or locked.client_id!=domain.client_id or locked.provider_domain_id!=domain.provider_domain_id or locked.expiry_date!=domain.expiry_date or load(new)[1]!=secret:
            raise RegistrationRefused()
        locked.metadata={**locked.metadata,KEY:{**entry,"grant":signing.dumps({**grant,"route":new},salt=SALT),
            "reauthorized_at":timezone.now().isoformat()}}
        locked.save(update_fields=["metadata","updated_at"])
        AuditLog.objects.create(actor=user,action="registrar_resource_reauthorized",entity_type="Domain",entity_id=str(domain.pk),entity_name=domain.domain_name,
            details={"connection_id":str(row.pk),"old_version":old["credential_version"],"new_version":row.current_version,"provider_resource_id":domain.provider_domain_id})
    return {"domain":domain.domain_name,"credential_version":row.current_version,"state":"reauthorized"}

@api_view(["POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def reauthorize_view(request,connection_id):
    assert_admin(request.user)
    data=request.data
    if not isinstance(data,dict) or set(data)!={"domain_public_id","confirm_password","totp_code"}:raise ValidationError("Provide the exact domain UUID and fresh authenticator.")
    check_mutation(request.user,data["confirm_password"],data["totp_code"])
    try:return Response(reauthorize(request.user,connection_id,data["domain_public_id"]),headers=HEADERS)
    except (RegistrationRefused,ValueError,KeyError,TypeError,AttributeError,DatabaseError,signing.BadSignature,VaultUnavailable,Domain.DoesNotExist,IntegrationConnection.DoesNotExist,IntegrationCredentialVersion.DoesNotExist):
        raise ValidationError("Resource could not be reauthorized. Resolve uncertain operations and verify the same supplier account.") from None
