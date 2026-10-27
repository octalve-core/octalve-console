from django.contrib import admin
from .models import Provider, ProviderPackage, ProviderLog, ProviderHealthCheck

@admin.register(Provider)
class ProviderAdmin(admin.ModelAdmin):
    """Existing provider profiles are view-only until secure connections are qualified."""
    list_display = ['name','adapter_type','status','health_status','test_mode','last_health_check']
    list_filter = ['adapter_type','status','health_status','test_mode']
    search_fields = ['name','base_url','username']
    readonly_fields = ['name','adapter_type','description','username',
                       'server_group','status','test_mode','health_status','last_health_check',
                       'created_at','updated_at']
    fieldsets = (
        ('Provider', {'fields':('name','adapter_type','description','base_url','username','server_group')}),
        ('Status', {'fields':('status','test_mode','health_status','last_health_check')}),
        ('History', {'fields':('created_at','updated_at')}),
    )
    def has_add_permission(self, request):
        return False
    def has_change_permission(self, request, obj=None):
        return False
    def has_delete_permission(self, request, obj=None):
        return False

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
