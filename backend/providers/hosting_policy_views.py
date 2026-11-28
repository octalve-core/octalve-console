"""MFA-protected one-time supplier policy, using the existing Integration Store."""
from django.db import transaction,DatabaseError
from django.conf import settings
from rest_framework.decorators import api_view,permission_classes,throttle_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from catalog.permissions import InternalSupplierAuthority
from providers.connection_views import require_write_authority,VaultMutationThrottle
from providers.connection_models import IntegrationConnection
from providers.connection_vault import VaultUnavailable
from providers.hosting_inventory import read_inventory,stage_inventory,BINDING,VERSION,ADAPTERS
from providers.hosting_runtime import release_enabled,load_hosting_connection,sign_policy,POLICY,validate_resource_capabilities
from providers.pinned_egress import public_ip
from providers.models import Provider
from providers.inventory import InventoryError
from audit.models import AuditLog

@api_view(["POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def configure_execution(request,connection_id):
    # Global production write capability remains disabled until platform-level
    # vendor acceptance. No per-supplier environment variable or code change.
    if not release_enabled():
        raise VaultUnavailable()
    require_write_authority(request)
    data=request.data
    required={"confirm_password","totp_code","fulfillment_model","shared_ip","accept"}
    if (not isinstance(data,dict) or not required<=set(data)
            or set(data)-required-{"native_panel_access","resource_capabilities"}
            or ("native_panel_access" in data and type(data["native_panel_access"]) is not bool)):
        raise ValidationError("Only documented supplier policy fields are accepted.")
    if data["accept"] is not True or data["fulfillment_model"] not in ("owned_server","partner_reseller"):
        raise ValidationError("Confirm the supplier execution policy.")
    if "resource_capabilities" in data:
        try:
            capabilities=validate_resource_capabilities(data["resource_capabilities"])
        except VaultUnavailable:
            raise ValidationError("Invalid hosting resource capabilities.") from None
        if capabilities and not getattr(settings,"CLOUD_HOSTING_NATIVE_RESOURCES_ENABLED",False):
            raise ValidationError("Native resource release is not enabled.")
    try:
        row=IntegrationConnection.objects.get(pk=connection_id,state="draft",environment="live")
        if row.adapter_key=="cpanel-whm" and "resource_capabilities" in data and any(x in capabilities for x in ("subdomain_create","subdomain_delete")):
            raise ValidationError("Native subdomain mutations have not yet been qualified for this supplier.")
        if row.adapter_key not in ADAPTERS:
            raise ValidationError("Unsupported hosting supplier.")
        if row.adapter_key=="directadmin":
            try: shared=public_ip(data["shared_ip"])
            except ValueError: raise ValidationError("Enter an approved public shared hosting IP.") from None
        else:
            if data["shared_ip"] is not None:
                raise ValidationError("WHM selects its own shared IP.")
            shared=None
        provider=Provider.objects.get(config__hosting_vault_connection_id=str(row.pk))
        current,key,_=load_hosting_connection(provider,require_policy=False)
        if current.pk!=row.pk:
            raise VaultUnavailable()
        offers=read_inventory(row,{ADAPTERS[row.adapter_key][1]:key})
        with transaction.atomic():
            locked=IntegrationConnection.objects.select_for_update().get(pk=row.pk)
            provider=Provider.objects.select_for_update().get(pk=provider.pk)
            if (locked.state!="draft" or locked.current_version!=row.current_version
                    or locked.public_settings!=row.public_settings or locked.updated_at!=row.updated_at):
                raise VaultUnavailable()
            load_hosting_connection(provider,require_policy=False)
            stage_inventory(row,offers,request.user)
            provider.refresh_from_db()
            provider.config={**provider.config,"hosting_account_owner":provider.username,
                "fulfillment_model":data["fulfillment_model"]}
            if "native_panel_access" in data:
                provider.config["native_panel_access"]=data["native_panel_access"]
            if "resource_capabilities" in data:
                provider.config["resource_capabilities"]=capabilities
            provider.config[POLICY]=sign_policy(provider,locked,shared)
            provider.status="active"
            provider.save(update_fields=["config","status","updated_at"])
            AuditLog.objects.create(actor=request.user,action="hosting_supplier_policy_approved",
                entity_type="IntegrationConnection",entity_id=str(row.pk),entity_name=row.adapter_key,
                details={"credential_version":locked.current_version,"provider_id":provider.pk,
                    "fulfillment_model":data["fulfillment_model"],"execution_policy":True,
                    "native_panel_access":provider.config.get("native_panel_access",False),
                    "resource_capabilities":provider.config.get("resource_capabilities",[])})
        return Response({"configured":True,"provider_id":provider.pk,
            "package_count":len(offers),"native_panel_access":provider.config.get("native_panel_access",False),
            "resource_capabilities":provider.config.get("resource_capabilities",[]),
            "commercial_payment_enabled":False},headers={"Cache-Control":"private, no-store"})
    except (IntegrationConnection.DoesNotExist,Provider.DoesNotExist,Provider.MultipleObjectsReturned,
            InventoryError,DatabaseError):
        raise VaultUnavailable() from None
