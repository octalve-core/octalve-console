# audit/serializers.py

from rest_framework import serializers
from .models import (
    AuditLog, LoginAttempt, APIAccessLog, 
    SecurityEvent, DataExportLog, SystemHealthLog
)


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for audit logs"""
    
    actor_name = serializers.CharField(source='actor.full_name', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'actor', 'actor_name', 'actor_email', 'actor_role', 'actor_ip',
            'action', 'action_display', 'entity_type', 'entity_id', 'entity_name',
            'old_value', 'new_value', 'details', 'error_message',
            'request_method', 'request_path', 'created_at'
        ]
        read_only_fields = '__all__'


class LoginAttemptSerializer(serializers.ModelSerializer):
    """Serializer for login attempts"""
    
    class Meta:
        model = LoginAttempt
        fields = ['id', 'email', 'ip_address', 'was_successful', 'failure_reason', 'created_at']
        read_only_fields = '__all__'


class APIAccessLogSerializer(serializers.ModelSerializer):
    """Serializer for API access logs"""
    
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = APIAccessLog
        fields = [
            'id', 'user', 'user_name', 'user_email', 'api_key_id', 'method',
            'path', 'query_string', 'status_code', 'response_time_ms',
            'ip_address', 'created_at'
        ]
        read_only_fields = '__all__'


class SecurityEventSerializer(serializers.ModelSerializer):
    """Serializer for security events"""
    
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    resolved_by_name = serializers.CharField(source='resolved_by.full_name', read_only=True)
    
    class Meta:
        model = SecurityEvent
        fields = [
            'id', 'event_type', 'event_type_display', 'severity', 'severity_display',
            'user', 'user_name', 'user_email', 'ip_address', 'description',
            'details', 'is_resolved', 'resolved_by_name', 'resolution_note',
            'created_at', 'resolved_at'
        ]
        read_only_fields = ['id', 'created_at']


class DataExportLogSerializer(serializers.ModelSerializer):
    """Serializer for data export logs"""
    
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = DataExportLog
        fields = [
            'id', 'user', 'user_name', 'user_email', 'export_type', 'filters',
            'file_url', 'file_size', 'status', 'status_display', 'error_message',
            'expires_at', 'created_at', 'completed_at'
        ]
        read_only_fields = '__all__'


class SystemHealthLogSerializer(serializers.ModelSerializer):
    """Serializer for system health logs"""
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = SystemHealthLog
        fields = '__all__'
        read_only_fields = '__all__'


class AuditStatsSerializer(serializers.Serializer):
    """Serializer for audit statistics"""
    
    total_actions = serializers.IntegerField()
    by_action = serializers.DictField()
    by_user = serializers.DictField()
    by_date = serializers.DictField()
    last_24h = serializers.IntegerField()
    last_7d = serializers.IntegerField()
    last_30d = serializers.IntegerField()