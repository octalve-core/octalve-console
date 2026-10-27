# providers/models.py

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from cryptography.fernet import Fernet
from django.conf import settings
import json

# ============================================
# PROVIDER MODEL
# ============================================

class Provider(models.Model):
    """Service providers like DirectAdmin, cPanel, Cloudflare, etc."""
    
    ADAPTER_TYPES = [
        ('DirectAdminAdapter', 'DirectAdmin'),
        ('CpanelAdapter', 'cPanel/WHM'),
        ('PleskAdapter', 'Plesk'),
        ('VirtualizorAdapter', 'Virtualizor'),
        ('ProxmoxAdapter', 'Proxmox VE'),
        ('EnhanceAdapter', 'Enhance'),
        ('PterodactylAdapter', 'Pterodactyl'),
        ('VirtFusionAdapter', 'VirtFusion'),
        ('CloudflareAdapter', 'Cloudflare'),
        ('DomainRegistrarAdapter', 'Domain Registrar'),
        ('SslProviderAdapter', 'SSL Provider'),
        ('EmailProviderAdapter', 'Email Provider'),
        ('BackupProviderAdapter', 'Backup Provider'),
        ('CustomProviderAdapter', 'Custom'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('maintenance', 'Maintenance'),
        ('error', 'Error'),
    ]
    
    # Basic info
    name = models.CharField(max_length=200)
    adapter_type = models.CharField(max_length=50, choices=ADAPTER_TYPES)
    description = models.TextField(blank=True, null=True)
    
    # Connection settings
    base_url = models.URLField(help_text="API endpoint URL")
    username = models.CharField(max_length=200, blank=True, null=True)
    encrypted_api_key = models.TextField(blank=True, null=True, help_text="Encrypted API key")
    encrypted_secret = models.TextField(blank=True, null=True, help_text="Encrypted secret key")
    
    # Additional config
    server_group = models.CharField(max_length=100, blank=True, null=True)
    config = models.JSONField(default=dict, blank=True, help_text="Additional provider configuration")
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    test_mode = models.BooleanField(default=False, help_text="Use test/sandbox mode")
    
    # Health tracking
    health_status = models.CharField(max_length=20, default='unknown', choices=[
        ('healthy', 'Healthy'),
        ('degraded', 'Degraded'),
        ('unhealthy', 'Unhealthy'),
        ('unknown', 'Unknown'),
    ])
    last_health_check = models.DateTimeField(blank=True, null=True)
    health_check_message = models.TextField(blank=True, null=True)
    
    # Limits
    max_connections = models.IntegerField(default=10, help_text="Maximum concurrent connections")
    timeout_seconds = models.IntegerField(default=30, help_text="Request timeout in seconds")
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['adapter_type']),
            models.Index(fields=['status']),
            models.Index(fields=['health_status']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.get_adapter_type_display()})"
    
    def get_api_key(self):
        """Decrypt and return API key"""
        if not self.encrypted_api_key:
            return None
        try:
            fernet = Fernet(settings.ENCRYPTION_KEY)
            return fernet.decrypt(self.encrypted_api_key.encode()).decode()
        except:
            return None
    
    def set_api_key(self, value):
        """Encrypt and store API key"""
        if value:
            fernet = Fernet(settings.ENCRYPTION_KEY)
            self.encrypted_api_key = fernet.encrypt(value.encode()).decode()
        else:
            self.encrypted_api_key = None
    
    def get_secret(self):
        """Decrypt and return secret"""
        if not self.encrypted_secret:
            return None
        try:
            fernet = Fernet(settings.ENCRYPTION_KEY)
            return fernet.decrypt(self.encrypted_secret.encode()).decode()
        except:
            return None
    
    def set_secret(self, value):
        """Encrypt and store secret"""
        if value:
            fernet = Fernet(settings.ENCRYPTION_KEY)
            self.encrypted_secret = fernet.encrypt(value.encode()).decode()
        else:
            self.encrypted_secret = None
    
    def update_health(self, is_healthy, message=None):
        """Update provider health status"""
        self.last_health_check = timezone.now()
        self.health_status = 'healthy' if is_healthy else 'unhealthy'
        self.health_check_message = message
        self.save(update_fields=['health_status', 'last_health_check', 'health_check_message'])
    
    def save(self, *args, **kwargs):
        # Ensure metadata is dict
        if not self.metadata:
            self.metadata = {}
        super().save(*args, **kwargs)


# ============================================
# PROVIDER PACKAGE
# ============================================

class ProviderPackage(models.Model):
    """Packages fetched from provider (for sync)"""
    
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name='packages')
    provider_package_id = models.CharField(max_length=200)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    
    # Package details
    specs = models.JSONField(default=dict, blank=True, help_text="CPU, RAM, disk, bandwidth, etc.")
    pricing = models.JSONField(default=dict, blank=True, help_text="Pricing information")
    
    # Sync info
    raw_data = models.JSONField(default=dict, blank=True, help_text="Raw provider response")
    is_active = models.BooleanField(default=True)
    last_synced_at = models.DateTimeField(auto_now=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['provider', 'provider_package_id']
        indexes = [
            models.Index(fields=['provider', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.provider.name} - {self.name}"


# ============================================
# PROVIDER LOG
# ============================================

class ProviderLog(models.Model):
    """Log all provider API requests/responses"""
    
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name='logs')
    
    # Request info
    action = models.CharField(max_length=100)
    endpoint = models.CharField(max_length=500)
    method = models.CharField(max_length=10)
    request_body = models.TextField(blank=True, null=True, help_text="Redacted request body")
    
    # Response info
    status_code = models.IntegerField()
    response_body = models.TextField(blank=True, null=True, help_text="Redacted response body")
    success = models.BooleanField(default=False)
    
    # Timing
    duration_ms = models.IntegerField(help_text="Request duration in milliseconds")
    
    # Error info
    error_message = models.TextField(blank=True, null=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['provider', '-created_at']),
            models.Index(fields=['action', 'success']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.provider.name} - {self.action} - {self.created_at}"
    
    @property
    def is_error(self):
        return self.status_code >= 400 or not self.success


# ============================================
# PROVIDER HEALTH CHECK
# ============================================

class ProviderHealthCheck(models.Model):
    """Historical health check records"""
    
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, related_name='health_checks')
    status = models.CharField(max_length=20, choices=[
        ('healthy', 'Healthy'),
        ('degraded', 'Degraded'),
        ('unhealthy', 'Unhealthy'),
    ])
    response_time_ms = models.IntegerField()
    message = models.TextField(blank=True, null=True)
    checked_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-checked_at']
        indexes = [
            models.Index(fields=['provider', '-checked_at']),
        ]
    
    def __str__(self):
        return f"{self.provider.name} - {self.status} at {self.checked_at}"


# Keep the new connection vault separate from the legacy hosting Provider model.
from .connection_models import IntegrationConnection, IntegrationCredentialVersion, IntegrationConnectionEvent, ProviderVaultAuthenticator  # noqa: E402,F401
