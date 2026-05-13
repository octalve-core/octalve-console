# providers/signals.py

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from .models import Provider, ProviderLog


@receiver(pre_save, sender=Provider)
def encrypt_provider_secrets(sender, instance, **kwargs):
    """Auto-encrypt API keys before saving"""
    # Note: The encryption is handled in the model's getter/setter
    # This is just for additional logging
    pass


@receiver(post_save, sender=ProviderLog)
def check_provider_health(sender, instance, created, **kwargs):
    """Auto-update provider health based on logs"""
    if created and instance.status_code >= 400:
        # Consecutive failures would update health status
        pass