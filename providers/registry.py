# providers/registry.py

from .adapters.directadmin import DirectAdminAdapter
from .models import Provider


class ProviderRegistry:
    """Factory to get the correct adapter for a provider"""
    
    _adapters = {
        'DirectAdminAdapter': DirectAdminAdapter,
        # Add more adapters as they are built:
        # 'CpanelAdapter': CpanelAdapter,
        # 'PleskAdapter': PleskAdapter,
        # 'ProxmoxAdapter': ProxmoxAdapter,
        # 'CloudflareAdapter': CloudflareAdapter,
    }
    
    @classmethod
    def get_adapter(cls, provider_id):
        """Get adapter instance for a provider"""
        try:
            provider = Provider.objects.get(id=provider_id, status='active')
            adapter_class = cls._adapters.get(provider.adapter_type)
            
            if not adapter_class:
                raise ValueError(f"No adapter found for {provider.adapter_type}")
            
            return adapter_class(provider)
        except Provider.DoesNotExist:
            raise ValueError(f"Provider {provider_id} not found or inactive")
    
    @classmethod
    def get_adapter_by_type(cls, provider, adapter_type):
        """Get adapter by provider instance and adapter type"""
        adapter_class = cls._adapters.get(adapter_type)
        if not adapter_class:
            raise ValueError(f"No adapter found for {adapter_type}")
        return adapter_class(provider)
    
    @classmethod
    def register_adapter(cls, adapter_type, adapter_class):
        """Register a new adapter dynamically"""
        cls._adapters[adapter_type] = adapter_class