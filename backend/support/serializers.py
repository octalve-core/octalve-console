# support/serializers.py

from rest_framework import serializers
from .models import (
    SupportDepartment, SupportTicket, TicketMessage, SupportRoutingTag,
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
    
    def validate_assigned_staff(self, people):
        if any(not person.is_active or person.role not in ("staff","admin") for person in people):
            raise serializers.ValidationError("Staff must be active and authorized.")
        return people

    def to_representation(self, obj):
        data=super().to_representation(obj)
        request=self.context.get("request")
        if request and request.user.role=="client":
            for key in ("email","assigned_staff","staff_count","auto_close_days",
                        "notify_new_ticket","notify_new_reply","auto_assign"):
                data.pop(key,None)
        return data

    def get_staff_count(self, obj):
        return obj.assigned_staff.count()


class SupportRoutingTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportRoutingTag
        fields = ["id", "department", "slug", "label", "is_active", "assigned_staff"]
        read_only_fields = ["id"]

    def to_representation(self, obj):
        data=super().to_representation(obj)
        request=self.context.get("request")
        if request and request.user.role=="client":
            data.pop("assigned_staff",None)
        return data

    def validate_assigned_staff(self, value):
        if any(not user.is_active or user.role not in ("staff","admin") for user in value):
            raise serializers.ValidationError("All assigned specialists must be active staff.")
        return value

    def validate(self, attrs):
        dept = attrs.get("department", getattr(self.instance,"department",None))
        people = attrs.get("assigned_staff")
        if people is not None and dept is not None:
            eligible = set(dept.assigned_staff.values_list("pk",flat=True))
            if any(user.pk not in eligible for user in people):
                raise serializers.ValidationError({"assigned_staff":"Staff must belong to the department."})
        return attrs


class TicketMessageSerializer(serializers.ModelSerializer):
    """Serializer for ticket messages"""
    
    sender_name_display = serializers.CharField(source='sender.full_name', read_only=True)
    sender_email = serializers.EmailField(source='sender.email', read_only=True)
    
    def to_representation(self, instance):
        data=super().to_representation(instance)
        request=self.context.get("request")
        if request and request.user.role=="client":
            for key in ("sender","sender_email","attachments"):
                data.pop(key,None)
        return data

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
    messages = serializers.SerializerMethodField()

    def get_messages(self, ticket):
        user = self.context["request"].user
        rows = ticket.messages.all()
        if user.role == "client":
            rows = rows.filter(is_internal=False)
        return TicketMessageSerializer(rows, many=True,context=self.context).data
    attachments = serializers.SerializerMethodField()

    def get_attachments(self, ticket):
        # Explicitly unavailable until a private, account-authorized file service exists.
        return []
    
    class Meta:
        model = SupportTicket
        fields = [
            'id', 'ticket_number', 'client', 'client_name', 'client_email',
            'department', 'department_name', 'routing_tag', 'subject', 'priority', 'priority_display',
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
        user=self.context['request'].user
        messages=obj.messages.all()
        if user.role=='client':
            messages=messages.filter(is_internal=False)
        last_msg=messages.order_by('-created_at').first()
        if last_msg:
            return {
                'message': last_msg.message[:100],
                'sender_role': last_msg.sender_role,
                'created_at': last_msg.created_at
            }
        return None


class CreateTicketSerializer(serializers.Serializer):
    """Serializer for creating a new ticket"""
    
    department_id = serializers.IntegerField(min_value=1)
    routing_tag_id = serializers.IntegerField(required=False,allow_null=True,min_value=1)
    subject = serializers.CharField(max_length=500)
    message = serializers.CharField(max_length=20000)
    priority = serializers.ChoiceField(choices=['low', 'medium', 'high', 'urgent'], default='medium')
    service_id = serializers.IntegerField(required=False, allow_null=True)
    order_id = serializers.IntegerField(required=False, allow_null=True)
    invoice_id = serializers.IntegerField(required=False, allow_null=True)
    def validate(self, attrs):
        if self.initial_data.get("attachments"):
            raise serializers.ValidationError({"attachments":"Attachments are not enabled yet."})
        tag_id = attrs.get("routing_tag_id")
        if tag_id is not None and not SupportRoutingTag.objects.filter(
            id=tag_id,department_id=attrs["department_id"],is_active=True
        ).exists():
            raise serializers.ValidationError({"routing_tag_id":"Choose a valid support topic."})
        return attrs

    def validate_department_id(self, value):
        from .models import SupportDepartment
        try:
            department = SupportDepartment.objects.get(id=value, is_active=True)
            return value
        except SupportDepartment.DoesNotExist:
            raise serializers.ValidationError("Invalid department")


class ReplyTicketSerializer(serializers.Serializer):
    """Serializer for replying to a ticket"""
    
    message = serializers.CharField(max_length=20000)
    is_internal = serializers.BooleanField(default=False)
    # Private attachment storage is not enabled yet.


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

