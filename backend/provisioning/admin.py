# provisioning/admin.py

from django.contrib import admin
from django.utils.html import format_html
from .models import (
    ProvisioningTask, ProvisioningQueue, ProvisioningLog,
    ProvisioningWebhook, WebhookDelivery
)


class ProvisioningLogInline(admin.TabularInline):
    model = ProvisioningLog
    extra = 0
    readonly_fields = ['created_at']


@admin.register(ProvisioningTask)
class ProvisioningTaskAdmin(admin.ModelAdmin):
    list_display = ['id', 'service_link', 'action', 'status', 'attempt_count', 'priority', 'scheduled_at', 'created_at']
    list_filter = ['status', 'action', 'priority']
    search_fields = ['service__label', 'service__client__email', 'last_error']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [ProvisioningLogInline]
    
    def service_link(self, obj):
        if obj.service:
            return format_html('<a href="/admin/services/service/{}/">{}</a>', obj.service.id, obj.service.label)
        return '-'
    service_link.short_description = 'Service'
    
    actions = ['retry_tasks', 'cancel_tasks']
    
    def retry_tasks(self, request, queryset):
        for task in queryset.filter(status__in=['failed', 'retrying']):
            task.status = 'queued'
            task.scheduled_at = timezone.now()
            task.save()
        self.message_user(request, f"{queryset.count()} tasks queued for retry")
    retry_tasks.short_description = "Retry selected tasks"
    
    def cancel_tasks(self, request, queryset):
        for task in queryset.filter(status__in=['queued', 'retrying']):
            task.status = 'cancelled'
            task.save()
        self.message_user(request, f"{queryset.count()} tasks cancelled")
    cancel_tasks.short_description = "Cancel selected tasks"


@admin.register(ProvisioningQueue)
class ProvisioningQueueAdmin(admin.ModelAdmin):
    list_display = ['queue_name', 'queue_type', 'current_tasks', 'total_processed', 'total_succeeded', 'is_active']
    list_filter = ['queue_type', 'is_active']
    readonly_fields = ['total_processed', 'total_succeeded', 'total_failed', 'current_tasks']


@admin.register(ProvisioningWebhook)
class ProvisioningWebhookAdmin(admin.ModelAdmin):
    list_display = ['url', 'is_active', 'success_count', 'failure_count', 'created_at']
    list_filter = ['is_active']
    search_fields = ['url']


@admin.register(WebhookDelivery)
class WebhookDeliveryAdmin(admin.ModelAdmin):
    list_display = ['webhook', 'event', 'attempt', 'response_status', 'success', 'delivered_at']
    list_filter = ['success', 'event']
    search_fields = ['webhook__url']
    readonly_fields = ['delivered_at']
