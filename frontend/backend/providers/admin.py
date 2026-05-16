# providers/admin.py

from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html
from .models import Provider, ProviderPackage, ProviderLog, ProviderHealthCheck


@admin.register(Provider)
class ProviderAdmin(admin.ModelAdmin):
    list_display = ['name', 'adapter_type', 'status', 'health_status', 'test_mode', 'last_health_check', 'connection_test_button']
    list_filter = ['adapter_type', 'status', 'health_status', 'test_mode']
    search_fields = ['name', 'base_url', 'username']
    readonly_fields = ['health_status', 'last_health_check', 'health_check_message', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'adapter_type', 'description')
        }),
        ('Connection Settings', {
            'fields': ('base_url', 'username', 'encrypted_api_key', 'encrypted_secret', 'server_group')
        }),
        ('Configuration', {
            'fields': ('config', 'test_mode', 'max_connections', 'timeout_seconds')
        }),
        ('Status', {
            'fields': ('status', 'health_status', 'last_health_check', 'health_check_message')
        }),
        ('Metadata', {
            'fields': ('metadata', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def connection_test_button(self, obj):
        return format_html(
            '<a class="button" href="{}">Test Connection</a>',
            reverse('admin:providers_provider_test', args=[obj.pk])
        )
    connection_test_button.short_description = 'Test Connection'


@admin.register(ProviderPackage)
class ProviderPackageAdmin(admin.ModelAdmin):
    list_display = ['name', 'provider', 'provider_package_id', 'is_active', 'last_synced_at']
    list_filter = ['provider', 'is_active']
    search_fields = ['name', 'provider_package_id']
    readonly_fields = ['last_synced_at', 'created_at', 'updated_at']


@admin.register(ProviderLog)
class ProviderLogAdmin(admin.ModelAdmin):
    list_display = ['provider', 'action', 'method', 'status_code', 'success', 'duration_ms', 'created_at']
    list_filter = ['provider', 'method', 'success', 'status_code']
    search_fields = ['action', 'endpoint', 'error_message']
    readonly_fields = ['created_at']
    
    def has_add_permission(self, request):
        return False
