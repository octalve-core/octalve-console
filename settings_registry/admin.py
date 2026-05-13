# settings_registry/admin.py

from django.contrib import admin
from .models import SettingGroup, Setting, SettingChangeLog, EmailTemplate, BrandingSettings, TaxSettings, SystemConfig


@admin.register(SettingGroup)
class SettingGroupAdmin(admin.ModelAdmin):
    list_display = ['key', 'name', 'sort_order', 'is_active']
    list_filter = ['is_active']
    search_fields = ['key', 'name']
    list_editable = ['sort_order', 'is_active']


@admin.register(Setting)
class SettingAdmin(admin.ModelAdmin):
    list_display = ['key', 'group', 'data_type', 'is_public', 'is_deprecated', 'sort_order']
    list_filter = ['group', 'data_type', 'is_public', 'is_deprecated']
    search_fields = ['key', 'name', 'description']
    list_editable = ['sort_order', 'is_public', 'is_deprecated']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('group', 'key', 'name', 'description', 'data_type')
        }),
        ('Values', {
            'fields': ('value', 'value_encrypted', 'default_value')
        }),
        ('Validation', {
            'fields': ('validation_rules', 'options'),
            'classes': ('collapse',)
        }),
        ('Display', {
            'fields': ('placeholder', 'is_required', 'is_encrypted', 'is_public', 'is_deprecated', 'sort_order')
        }),
        ('Metadata', {
            'fields': ('metadata', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = ['key', 'name', 'category', 'is_active', 'is_system']
    list_filter = ['category', 'is_active', 'is_system']
    search_fields = ['key', 'name', 'subject']
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('key', 'name', 'category', 'description')
        }),
        ('Content', {
            'fields': ('subject', 'subject_variables', 'body_html', 'body_text')
        }),
        ('Status', {
            'fields': ('is_active', 'is_system')
        }),
        ('Variables Documentation', {
            'fields': ('variables',),
            'classes': ('collapse',)
        }),
    )


@admin.register(BrandingSettings)
class BrandingSettingsAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not BrandingSettings.objects.exists()
    
    fieldsets = (
        ('Company Info', {
            'fields': ('company_name', 'company_logo', 'company_favicon', 'company_email', 'company_phone', 'company_address', 'company_website')
        }),
        ('Colors', {
            'fields': ('primary_color', 'secondary_color', 'accent_color')
        }),
        ('Email Branding', {
            'fields': ('email_logo', 'email_footer')
        }),
        ('Invoice Branding', {
            'fields': ('invoice_logo', 'invoice_footer', 'invoice_notes')
        }),
        ('Client Portal', {
            'fields': ('portal_title', 'portal_description')
        }),
    )


@admin.register(SystemConfig)
class SystemConfigAdmin(admin.ModelAdmin):
    fieldsets = (
        ('Maintenance', {
            'fields': ('maintenance_mode', 'maintenance_message', 'maintenance_allowed_ips')
        }),
        ('Mode', {
            'fields': ('debug_mode', 'demo_mode')
        }),
        ('Rate Limiting', {
            'fields': ('enable_rate_limiting', 'rate_limit_requests', 'rate_limit_burst')
        }),
        ('Session', {
            'fields': ('session_timeout_minutes', 'max_login_attempts', 'lockout_minutes')
        }),
        ('API', {
            'fields': ('enable_api', 'enable_api_docs', 'api_rate_limit')
        }),
        ('Cache', {
            'fields': ('enable_cache', 'cache_timeout_seconds')
        }),
        ('Background Tasks', {
            'fields': ('enable_async_tasks', 'task_worker_count', 'task_retry_delay')
        }),
    )
