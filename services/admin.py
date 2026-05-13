# services/admin.py

from django.contrib import admin
from .models import Service, ServiceCredential, ServiceUsage, ServiceActionLog, ServiceSuspension, ServiceChangeRequest


class ServiceCredentialInline(admin.StackedInline):
    model = ServiceCredential
    extra = 0
    readonly_fields = ['created_at', 'updated_at']


class ServiceUsageInline(admin.TabularInline):
    model = ServiceUsage
    extra = 0
    readonly_fields = ['recorded_at']
    max_num = 5


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ['label', 'client', 'service_type', 'status', 'next_due_date', 'amount']
    list_filter = ['status', 'service_type', 'auto_renew']
    search_fields = ['label', 'domain_name', 'client__email', 'provider_identifier']
    readonly_fields = ['created_at', 'updated_at', 'activated_at', 'suspended_at']
    inlines = [ServiceCredentialInline, ServiceUsageInline]
    fieldsets = (
        ('Basic Info', {
            'fields': ('client', 'label', 'service_type', 'domain_name', 'description')
        }),
        ('Product Info', {
            'fields': ('product_id', 'plan_id', 'provider_id', 'provider_identifier')
        }),
        ('Status', {
            'fields': ('status', 'auto_renew', 'next_due_date')
        }),
        ('Billing', {
            'fields': ('billing_cycle', 'amount', 'currency')
        }),
        ('Dates', {
            'fields': ('activated_at', 'suspended_at', 'terminated_at', 'cancelled_at')
        }),
        ('Features', {
            'fields': ('has_ssl', 'has_backup', 'has_malware_protection', 'has_cdn')
        }),
        ('Metadata', {
            'fields': ('config', 'metadata'),
            'classes': ('collapse',)
        }),
    )


@admin.register(ServiceActionLog)
class ServiceActionLogAdmin(admin.ModelAdmin):
    list_display = ['service', 'action', 'success', 'is_automatic', 'created_at']
    list_filter = ['action', 'success', 'is_automatic']
    search_fields = ['service__label', 'service__client__email']
    readonly_fields = ['created_at']


@admin.register(ServiceChangeRequest)
class ServiceChangeRequestAdmin(admin.ModelAdmin):
    list_display = ['service', 'change_type', 'status', 'created_at']
    list_filter = ['change_type', 'status']
    search_fields = ['service__label']
    readonly_fields = ['created_at', 'updated_at']

