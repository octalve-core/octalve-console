# support/admin.py

from django.contrib import admin
from django.utils.html import format_html
from .models import (
    SupportDepartment, SupportTicket, TicketMessage, SupportRoutingTag,
    PredefinedResponse, TicketEscalationRule, TicketAttachment, TicketSurvey
)


class TicketMessageInline(admin.TabularInline):
    model = TicketMessage
    extra = 0
    readonly_fields = ['created_at']
    fields = ['sender', 'sender_role', 'message', 'is_internal', 'created_at']


@admin.register(SupportDepartment)
class SupportDepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'auto_assign', 'auto_close_days', 'is_active', 'sort_order']
    list_filter = ['is_active', 'auto_assign']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    filter_horizontal = ['assigned_staff']


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ['ticket_number', 'client', 'subject_preview', 'department', 'priority', 'status', 'assigned_to', 'created_at']
    list_filter = ['status', 'priority', 'department', 'created_at']
    search_fields = ['ticket_number', 'client__email', 'client__full_name', 'subject']
    readonly_fields = ['ticket_number', 'created_at', 'updated_at', 'closed_at', 'resolved_at']
    inlines = [TicketMessageInline]
    fieldsets = (
        ('Ticket Info', {
            'fields': ('ticket_number', 'client', 'subject', 'department', 'priority', 'status')
        }),
        ('Assignment', {
            'fields': ('assigned_to',)
        }),
        ('Related', {
            'fields': ('service', 'order', 'invoice')
        }),
        ('Dates', {
            'fields': ('created_at', 'last_reply_at', 'closed_at', 'resolved_at')
        }),
        ('Feedback', {
            'fields': ('satisfaction_rating', 'satisfaction_comment'),
            'classes': ('collapse',)
        }),
    )
    
    def subject_preview(self, obj):
        return obj.subject[:50] + '...' if len(obj.subject) > 50 else obj.subject
    subject_preview.short_description = 'Subject'


@admin.register(PredefinedResponse)
class PredefinedResponseAdmin(admin.ModelAdmin):
    list_display = ['title', 'department', 'shortcut', 'is_active', 'usage_count']
    list_filter = ['department', 'is_active']
    search_fields = ['title', 'content', 'shortcut']


@admin.register(TicketEscalationRule)
class TicketEscalationRuleAdmin(admin.ModelAdmin):
    list_display = ['name', 'condition_type', 'condition_value', 'action_type', 'is_active', 'priority']
    list_filter = ['is_active', 'condition_type', 'action_type']
    search_fields = ['name']


@admin.register(TicketSurvey)
class TicketSurveyAdmin(admin.ModelAdmin):
    list_display = ['ticket', 'rating', 'would_recommend', 'submitted_at']
    list_filter = ['rating', 'would_recommend']
    readonly_fields = ['submitted_at']


@admin.register(SupportRoutingTag)
class SupportRoutingTagAdmin(admin.ModelAdmin):
    list_display = ["label","slug","department","is_active"]
    list_filter = ["department","is_active"]
    search_fields = ["label","slug"]
    filter_horizontal = ["assigned_staff"]
