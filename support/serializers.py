# support/serializers.py

from rest_framework import serializers
from .models import (
    SupportDepartment, SupportTicket, TicketMessage,
    PredefinedResponse, TicketEscalationRule, TicketAttachment, TicketSurvey
)


class SupportDepartmentSerializer(serializers.ModelSerializer):
    """Serializer for support departments"""
    
    staff_count = serializers.SerializerMethodField()
    
    class Meta:
        model = SupportDepartment
        fields = [
            'id', 'name', 'slug', 'description', 'email', 'assigned_staff',
            'staff_count', 'auto_assign', 'auto_close_days', 'notify_new_ticket',
            'notify_new_reply', 'is_active', 'sort_order', 'created_at'
        ]
        read_only_fields = ['id', 'slug', 'created_at']
    
    def get_staff_count(self, obj):
        return obj.assigned_staff.count()


class TicketMessageSerializer(serializers.ModelSerializer):
    """Serializer for ticket messages"""
    
    sender_name_display = serializers.CharField(source='sender.full_name', read_only=True)
    sender_email = serializers.EmailField(source='sender.email', read_only=True)
    
    class Meta:
        model = TicketMessage
        fields = [
            'id', 'sender', 'sender_name_display', 'sender_email', 'sender_role',
            'sender_name', 'message', 'is_internal', 'attachments', 'is_read',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'is_read', 'read_at']


class TicketAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for ticket attachments"""
    
    class Meta:
        model = TicketAttachment
        fields = ['id', 'filename', 'file_size', 'mime_type', 'file', 'uploaded_at']


class SupportTicketSerializer(serializers.ModelSerializer):
    """Serializer for support tickets"""
    
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    client_email = serializers.EmailField(source='client.email', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_overdue = serializers.SerializerMethodField()
    has_unread = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    messages = TicketMessageSerializer(many=True, read_only=True)
    attachments = TicketAttachmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = SupportTicket
        fields = [
            'id', 'ticket_number', 'client', 'client_name', 'client_email',
            'department', 'department_name', 'subject', 'priority', 'priority_display',
            'status', 'status_display', 'assigned_to', 'assigned_to_name',
            'service', 'order', 'invoice', 'last_reply_at', 'last_reply_by',
            'closed_at', 'resolved_at', 'satisfaction_rating', 'satisfaction_comment',
            'is_overdue', 'has_unread', 'last_message', 'messages', 'attachments',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'ticket_number', 'created_at', 'updated_at', 'closed_at', 'resolved_at']
    
    def get_is_overdue(self, obj):
        return obj.is_overdue()
    
    def get_has_unread(self, obj):
        user = self.context.get('request').user if self.context else None
        if user:
            return obj.has_unread_messages(user)
        return False
    
    def get_last_message(self, obj):
        last_msg = obj.get_last_message()
        if last_msg:
            return {
                'message': last_msg.message[:100],
                'sender_role': last_msg.sender_role,
                'created_at': last_msg.created_at
            }
        return None


class CreateTicketSerializer(serializers.Serializer):
    """Serializer for creating a new ticket"""
    
    department_id = serializers.IntegerField()
    subject = serializers.CharField(max_length=500)
    message = serializers.CharField()
    priority = serializers.ChoiceField(choices=['low', 'medium', 'high', 'urgent'], default='medium')
    service_id = serializers.IntegerField(required=False, allow_null=True)
    order_id = serializers.IntegerField(required=False, allow_null=True)
    invoice_id = serializers.IntegerField(required=False, allow_null=True)
    attachments = serializers.ListField(child=serializers.FileField(), required=False)
    
    def validate_department_id(self, value):
        from .models import SupportDepartment
        try:
            department = SupportDepartment.objects.get(id=value, is_active=True)
            return value
        except SupportDepartment.DoesNotExist:
            raise serializers.ValidationError("Invalid department")


class ReplyTicketSerializer(serializers.Serializer):
    """Serializer for replying to a ticket"""
    
    message = serializers.CharField()
    is_internal = serializers.BooleanField(default=False)
    attachments = serializers.ListField(child=serializers.FileField(), required=False)


class TicketActionSerializer(serializers.Serializer):
    """Serializer for ticket actions"""
    
    action = serializers.ChoiceField(choices=[
        ('close', 'Close Ticket'),
        ('resolve', 'Resolve Ticket'),
        ('reopen', 'Reopen Ticket'),
        ('assign', 'Assign to Staff'),
        ('change_priority', 'Change Priority'),
    ])
    staff_id = serializers.IntegerField(required=False, allow_null=True)
    priority = serializers.ChoiceField(choices=['low', 'medium', 'high', 'urgent'], required=False)
    reason = serializers.CharField(required=False, allow_blank=True)


class PredefinedResponseSerializer(serializers.ModelSerializer):
    """Serializer for predefined responses"""
    
    department_name = serializers.CharField(source='department.name', read_only=True)
    
    class Meta:
        model = PredefinedResponse
        fields = [
            'id', 'department', 'department_name', 'title', 'category',
            'content', 'shortcut', 'is_active', 'is_public', 'usage_count',
            'created_by', 'created_at'
        ]
        read_only_fields = ['usage_count', 'created_at']


class TicketEscalationRuleSerializer(serializers.ModelSerializer):
    """Serializer for ticket escalation rules"""
    
    class Meta:
        model = TicketEscalationRule
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class TicketSurveySerializer(serializers.ModelSerializer):
    """Serializer for ticket surveys"""
    
    class Meta:
        model = TicketSurvey
        fields = [
            'rating', 'comment', 'response_time_rating', 'resolution_quality_rating',
            'staff_courtesy_rating', 'would_recommend'
        ]


class TicketStatsSerializer(serializers.Serializer):
    """Serializer for ticket statistics"""
    
    open = serializers.IntegerField()
    in_progress = serializers.IntegerField()
    waiting_customer = serializers.IntegerField()
    waiting_staff = serializers.IntegerField()
    resolved = serializers.IntegerField()
    closed = serializers.IntegerField()
    total = serializers.IntegerField()
    overdue = serializers.IntegerField()
    by_priority = serializers.DictField()
    by_department = serializers.DictField()

