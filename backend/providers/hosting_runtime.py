"""Runtime consumption of the existing versioned hosting vault.

No legacy API-key copy. This broker cannot enable writes. The global release
gate and exact signed per-supplier policy are separate from inventory status.
"""
import hashlib
import hmac
import json
from uuid import UUID
from django.conf import settings
from providers.connection_audit import audit_keyring,verify_chain
from providers.connection_models import IntegrationConnection,IntegrationCredentialVersion
from providers.connection_vault import VaultUnavailable,unseal_version
from providers.connection_specs import validate_public_settings,validate_secrets
from providers.connection_views import connection_database_qualified
from providers.hosting_inventory import ADAPTERS,BINDING,VERSION
from providers.pinned_egress import public_ip
from rest_framework.exceptions import ValidationError

POLICY="hosting_execution_policy_v1"
RESOURCE_CAPABILITIES=frozenset(("mailbox_read","mailbox_create","mailbox_delete","mailbox_quota","mailbox_password","subdomain_read","subdomain_create","subdomain_delete","database_read","database_create","database_delete","hosting_password","database_user_read","database_user_create","database_user_delete","database_grants","forwarder_read","forwarder_create","forwarder_delete","autoresponder_read","autoresponder_delete","autoresponder_create","autoresponder_edit","mail_client_settings","webmail_launch","file_root_read","database_user_password","ssl_readiness","backup_read","lifecycle_suspend","lifecycle_restore","lifecycle_terminate"))


def validate_resource_capabilities(value):
    if (not isinstance(value,list) or len(value)>len(RESOURCE_CAPABILITIES)
            or any(not isinstance(x,str) or x not in RESOURCE_CAPABILITIES for x in value)
            or len(set(value))!=len(value) or (any(x in value for x in ("mailbox_create","mailbox_delete","mailbox_quota","mailbox_password")) and "mailbox_read" not in value)
            or (any(x in value for x in ("subdomain_create","subdomain_delete")) and "subdomain_read" not in value)
            or (any(x in value for x in ("database_create","database_delete")) and "database_read" not in value)
            or (any(x in value for x in ("forwarder_read","autoresponder_read","mail_client_settings","webmail_launch")) and "mailbox_read" not in value)
            or (any(x in value for x in ("forwarder_create","forwarder_delete")) and "forwarder_read" not in value)
            or (any(x in value for x in ("autoresponder_delete","autoresponder_create","autoresponder_edit")) and "autoresponder_read" not in value)
            or ("lifecycle_terminate" in value and "lifecycle_suspend" not in value)
            or ("lifecycle_restore" in value and "lifecycle_suspend" not in value)
            or ("database_user_read" in value and "database_read" not in value)
            or (any(x in value for x in ("database_user_create","database_user_delete","database_grants","database_user_password")) and "database_user_read" not in value)):
        raise VaultUnavailable()
    return sorted(value)



def qualified_vault():
    return bool(not settings.DEBUG and settings.CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED
        and settings.CLOUD_PROVIDER_CUSTODY_VERIFIED and connection_database_qualified())


def release_enabled():
    return bool(getattr(settings,"CLOUD_HOSTING_VENDOR_CREATE_ENABLED",False)
        and getattr(settings,"CLOUD_HOSTING_CONFIGURED_EGRESS_ENABLED",False)
        and getattr(settings,"CLOUD_SUPPLIER_PINNED_READBACK_ENABLED",False))


def policy_payload(provider,row,shared_ip):
    payload={"provider":provider.pk,"connection":str(row.pk),"version":row.current_version,
        "adapter":row.adapter_key,"environment":row.environment,"settings":row.public_settings,
        "owner":provider.username,"shared_ip":shared_ip,"fulfillment_model":provider.config.get("fulfillment_model")}
    # Existing signed policies remain valid. Native sessions are opt-in and
    # the authorization itself is covered by the same credential-bound MAC.
    if "native_panel_access" in provider.config:
        native=provider.config["native_panel_access"]
        if type(native) is not bool:
            raise VaultUnavailable()
        payload["native_panel_access"]=native
    if "resource_capabilities" in provider.config:
        payload["resource_capabilities"]=validate_resource_capabilities(provider.config["resource_capabilities"])
    return payload


def sign_policy(provider,row,shared_ip):
    payload=policy_payload(provider,row,shared_ip)
    active,keys=audit_keyring()
    digest=hmac.new(keys[active],json.dumps(payload,sort_keys=True,separators=(",",":")).encode(),
                    hashlib.sha256).hexdigest()
    return {"payload":payload,"key_id":active,"mac":digest}


def verify_policy(provider,row):
    policy=provider.config.get(POLICY)
    try:
        payload=policy["payload"]
        if payload!=policy_payload(provider,row,payload["shared_ip"]) or payload["fulfillment_model"] not in ("owned_server","partner_reseller"):
            raise VaultUnavailable()
        if row.adapter_key=="directadmin":
            if public_ip(payload["shared_ip"])!=payload["shared_ip"]:
                raise VaultUnavailable()
        elif payload["shared_ip"] is not None:
            raise VaultUnavailable()
        _,keys=audit_keyring()
        digest=hmac.new(keys[policy["key_id"]],json.dumps(payload,sort_keys=True,separators=(",",":")).encode(),
                        hashlib.sha256).hexdigest()
        if not hmac.compare_digest(policy["mac"],digest):
            raise VaultUnavailable()
        return payload
    except (KeyError,TypeError,ValueError,AttributeError):
        raise VaultUnavailable() from None


def load_hosting_connection(provider,*,require_policy=True):
    """Exact live supplier account and current nonrevoked credential only."""
    if not qualified_vault() or not release_enabled():
        raise VaultUnavailable()
    try:
        config=provider.config
        row=IntegrationConnection.objects.get(pk=UUID(config[BINDING]),state="draft",
            environment="live",current_version=config[VERSION])
        if (row.adapter_key not in ADAPTERS or provider.adapter_type!=ADAPTERS[row.adapter_key][0]
                or provider.test_mode or provider.encrypted_api_key or provider.encrypted_secret
                or provider.base_url!=row.public_settings.get("server_url")
                or provider.username!=row.public_settings.get("username")
                or provider.username.lower() in ("root","admin")
                or (require_policy and (provider.status!="active" or provider.health_status!="healthy"
                    or config.get("hosting_account_owner")!=provider.username))):
            raise VaultUnavailable()
        public=validate_public_settings(row.adapter_key,row.public_settings)
        if "server_ip" not in public:
            raise VaultUnavailable()
        verify_chain(row)
        version=IntegrationCredentialVersion.objects.select_related("connection").get(
            connection=row,version=row.current_version,revoked_at__isnull=True)
        stored=validate_secrets(row.adapter_key,unseal_version(version),row.environment)
        if version.connection.public_settings!=row.public_settings or version.connection.current_version!=row.current_version:
            raise VaultUnavailable()
        policy=verify_policy(provider,row) if require_policy else None
        return row,stored[ADAPTERS[row.adapter_key][1]],policy
    except (IntegrationConnection.DoesNotExist,IntegrationCredentialVersion.DoesNotExist,
            ValidationError,KeyError,ValueError,TypeError,AttributeError):
        raise VaultUnavailable() from None
