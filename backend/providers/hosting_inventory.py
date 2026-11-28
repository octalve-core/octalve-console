"""Read-only hosting inventory onboarding through the encrypted Integration Store.

A successful package read is evidence for private catalogue staging, not
authority to create accounts or accept live payments. No legacy secret copy.
"""
from types import SimpleNamespace
from django.db import transaction
from django.utils import timezone
from audit.models import AuditLog
from .connection_audit import verify_chain
from .connection_models import IntegrationConnection, IntegrationCredentialVersion
from .connection_specs import validate_public_settings
from .inventory import InventoryError, fetch_inventory
from .models import Provider, ProviderPackage

ADAPTERS = {"directadmin": ("DirectAdminAdapter", "login_key"),
            "cpanel-whm": ("CpanelAdapter", "api_token")}
BINDING = "hosting_vault_connection_id"
VERSION = "hosting_vault_version"


def read_inventory(connection, secrets):
    if connection.adapter_key not in ADAPTERS or connection.environment not in ("test", "live"):
        raise InventoryError("Unsupported hosting inventory connection.")
    settings = validate_public_settings(connection.adapter_key, connection.public_settings)
    adapter, key_name = ADAPTERS[connection.adapter_key]
    key = secrets.get(key_name)
    if not isinstance(key, str) or not 12 <= len(key) <= 4096 or any(ord(ch) < 33 or ord(ch) > 126 for ch in key):
        raise InventoryError("Invalid hosting inventory credential.")
    ephemeral = SimpleNamespace(base_url=settings["server_url"], username=settings["username"],
                                adapter_type=adapter, timeout_seconds=4, get_api_key=lambda: key)
    # Bounded serverless readback: fail closed, never import a partial catalogue.
    binding=(settings["server_url"],settings["server_ip"]) if "server_ip" in settings else None
    offers = fetch_inventory(ephemeral, max_packages=20 if adapter == "DirectAdminAdapter" else 100,
                             total_timeout=12,bound_origin=binding)
    if not offers:
        raise InventoryError("No eligible supplier packages were returned.")
    return offers


@transaction.atomic
def stage_inventory(connection, offers, actor):
    """Compare the exact credential generation before importing package evidence."""
    current = IntegrationConnection.objects.select_for_update().get(pk=connection.pk)
    if (current.state != "draft" or current.adapter_key != connection.adapter_key
            or current.environment != connection.environment
            or current.current_version != connection.current_version
            or current.public_settings != connection.public_settings
            or current.updated_at != connection.updated_at
            or not IntegrationCredentialVersion.objects.filter(connection=current,
                version=current.current_version, revoked_at__isnull=True).exists()):
        raise InventoryError("Hosting credential changed during verification.")
    verify_chain(current)
    adapter, _ = ADAPTERS[current.adapter_key]
    settings = current.public_settings
    identity = str(current.pk)
    rows = list(Provider.objects.select_for_update().filter(config__hosting_vault_connection_id=identity)[:2])
    if len(rows) > 1:
        raise InventoryError("Ambiguous hosting supplier binding.")
    provider = rows[0] if rows else None
    if provider and (provider.status != "inactive" or provider.adapter_type != adapter
            or provider.base_url != settings["server_url"] or provider.username != settings["username"]
            or provider.test_mode != (current.environment == "test")
            or provider.encrypted_api_key or provider.encrypted_secret):
        raise InventoryError("Existing hosting supplier requires a separate qualification.")
    if not provider:
        if Provider.objects.filter(adapter_type=adapter, base_url=settings["server_url"],
                                   username=settings["username"]).exists():
            raise InventoryError("This server account is already configured. Review its existing supplier.")
        provider = Provider.objects.create(name=current.label, adapter_type=adapter,
            base_url=settings["server_url"], username=settings["username"],
            status="inactive", test_mode=current.environment == "test",
            health_status="healthy", config={BINDING:identity, VERSION:current.current_version},
            last_health_check=timezone.now(), health_check_message="Inventory access verified")
    else:
        provider.config = {**provider.config, VERSION:current.current_version}
        provider.health_status = "healthy"
        provider.last_health_check = timezone.now()
        provider.health_check_message = "Inventory access verified"
        provider.save(update_fields=["config","health_status","last_health_check","health_check_message","updated_at"])
    seen = set()
    for offer in offers:
        package_id = offer["provider_package_id"]
        if package_id in seen or not isinstance(offer["specs"],dict) or not offer["specs"]:
            raise InventoryError("Invalid supplier package evidence.")
        seen.add(package_id)
        row, _ = ProviderPackage.objects.select_for_update().get_or_create(provider=provider,
            provider_package_id=package_id, defaults={"name":offer["name"],"is_active":False})
        changed = (row.name != offer["name"] or row.specs != offer["specs"]
                   or row.raw_data.get("credential_version") != current.current_version
                   or row.raw_data.get("available") is not True)
        row.name = offer["name"]
        row.specs = offer["specs"]
        row.raw_data = {"origin":"adapter_verified","adapter":adapter,"connection":identity,
                        "credential_version":current.current_version,"available":True}
        if changed:
            row.is_active = False
        row.save(update_fields=["name","specs","raw_data","is_active","last_synced_at","updated_at"])
    for row in ProviderPackage.objects.select_for_update().filter(provider=provider).exclude(provider_package_id__in=seen):
        row.is_active = False
        row.raw_data = {**row.raw_data,"available":False}
        row.save(update_fields=["is_active","raw_data","updated_at"])
    AuditLog.objects.create(actor=actor,action="provider_connection_test",
        entity_type="IntegrationConnection",entity_id=identity,entity_name=current.adapter_key,
        details={"adapter":current.adapter_key,"credential_version":current.current_version,
                 "verified":True,"read_only":True,"execution_enabled":False,
                 "checked_at":timezone.now().isoformat(),"hosting_provider_id":provider.pk,
                 "package_count":len(seen)})
    return {"authenticated":True,"read_only":True,"provider_id":provider.pk,
            "package_count":len(seen),"supplier_active":False,"retail_published":False,
            "provisioning_enabled":False}
