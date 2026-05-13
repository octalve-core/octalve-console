# audit/admin.py

from django.contrib import admin
from .models import AuditLog, LoginAttempt, APIAccessLog, SecurityEvent, DataExportLog, SystemHealthLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'actor_email', 'entity_type', 'entity_id', 'created_at']
    list_filter = ['action', 'actor_role', 'created_at']
    search_fields = ['actor_email', 'entity_name', 'details']
    readonly_fields = ['created_at']
    
    def has_add_permission(self, request):
        return False


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = ['email', 'ip_address', 'was_successful', 'created_at']
    list_filter = ['was_successful', 'created_at']
    search_fields = ['email', 'ip_address']
    readonly_fields = ['created_at']


@admin.register(APIAccessLog)
class APIAccessLogAdmin(admin.ModelAdmin):
    list_display = ['method', 'path', 'status_code', 'response_time_ms', 'user', 'created_at']
    list_filter = ['method', 'status_code', 'created_at']
    search_fields = ['path', 'ip_address']
    readonly_fields = ['created_at']


@admin.register(SecurityEvent)
class SecurityEventAdmin(admin.ModelAdmin):
    list_display = ['event_type', 'severity', 'ip_address', 'user_email', 'is_resolved', 'created_at']
    list_filter = ['event_type', 'severity', 'is_resolved', 'created_at']
    search_fields = ['description', 'ip_address', 'user_email']
    readonly_fields = ['created_at']


@admin.register(DataExportLog)
class DataExportLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'export_type', 'status', 'file_size', 'created_at']
    list_filter = ['export_type', 'status', 'created_at']
    search_fields = ['user__email']


@admin.register(SystemHealthLog)
class SystemHealthLogAdmin(admin.ModelAdmin):
    list_display = ['status', 'cpu_percent', 'memory_percent', 'disk_percent', 'recorded_at']
    list_filter = ['status', 'recorded_at']
    readonly_fields = ['recorded_at']
