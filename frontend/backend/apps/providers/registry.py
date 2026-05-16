from .adapters.directadmin import DirectAdminAdapter
from .adapters.cpanel import CpanelAdapter
from .adapters.plesk import PleskAdapter
from .adapters.virtualizor import VirtualizorAdapter
from .adapters.proxmox import ProxmoxAdapter
from .adapters.custom import CustomProviderAdapter
from .adapters.enhance import EnhanceAdapter
from .adapters.pterodactyl import PterodactylAdapter
from .adapters.virtfusion import VirtFusionAdapter
from .adapters.cloudflare import CloudflareAdapter
from .adapters.domain_registrar import DomainRegistrarAdapter
from .adapters.ssl_provider import SslProviderAdapter
from .adapters.email_provider import EmailProviderAdapter
from .adapters.backup_provider import BackupProviderAdapter

ADAPTER_REGISTRY = {
    "DirectAdminAdapter": DirectAdminAdapter,
    "CpanelAdapter": CpanelAdapter,
    "PleskAdapter": PleskAdapter,
    "VirtualizorAdapter": VirtualizorAdapter,
    "ProxmoxAdapter": ProxmoxAdapter,
    "CustomProviderAdapter": CustomProviderAdapter,
    "EnhanceAdapter": EnhanceAdapter,
    "PterodactylAdapter": PterodactylAdapter,
    "VirtFusionAdapter": VirtFusionAdapter,
    "CloudflareAdapter": CloudflareAdapter,
    "DomainRegistrarAdapter": DomainRegistrarAdapter,
    "SslProviderAdapter": SslProviderAdapter,
    "EmailProviderAdapter": EmailProviderAdapter,
    "BackupProviderAdapter": BackupProviderAdapter,
}


def get_adapter(adapter_type: str, provider_config: dict):
    adapter_class = ADAPTER_REGISTRY[adapter_type]
    return adapter_class(provider_config)
