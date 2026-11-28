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


def qualified_vault():
    return bool(not settings.DEBUG and settings.CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED
        and settings.CLOUD_PROVIDER_CUSTODY_VERIFIED and connection_database_qualified())


def release_enabled():
    return bool(getattr(settings,"CLOUD_HOSTING_VENDOR_CREATE_ENABLED",False)
        and getattr(settings,"CLOUD_HOSTING_CONFIGURED_EGRESS_ENABLED",False)
        and getattr(settings,"CLOUD_SUPPLIER_PINNED_READBACK_ENABLED",False))


def policy_payload(provider,row,shared_ip):
    return {"provider":provider.pk,"connection":str(row.pk),"version":row.current_version,
        "adapter":row.adapter_key,"environment":row.environment,"settings":row.public_settings,
        "owner":provider.username,"shared_ip":shared_ip}


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
        if payload!=policy_payload(provider,row,payload["shared_ip"]):
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
