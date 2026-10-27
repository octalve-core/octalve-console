# services/serializers.py

from rest_framework import serializers
from .models import (
    Service, ServiceCredential, ServiceUsage, 
    ServiceActionLog, ServiceSuspension, ServiceChangeRequest
)


class ServiceCredentialSerializer(serializers.ModelSerializer):
    """Serializer for service credentials"""
    
    password = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = ServiceCredential
        fields = [
            'id', 'username', 'password', 'control_panel_url', 'ftp_server',
            'ftp_port', 'database_host', 'database_name', 'database_user',
            'nameserver1', 'nameserver2', 'nameserver3', 'nameserver4',
            'metadata'
        ]
        read_only_fields = ['id']
    
    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        if password:
            instance.set_password(password)
        return super().update(instance, validated_data)


class ServiceUsageSerializer(serializers.ModelSerializer):
    """Serializer for service usage"""
    
    class Meta:
        model = ServiceUsage
        fields = [
            'id', 'disk_used_mb', 'disk_limit_mb', 'disk_percent',
            'bandwidth_used_mb', 'bandwidth_limit_mb', 'bandwidth_percent',
            'email_used', 'email_limit', 'database_used', 'database_limit',
            'addon_domains_used', 'subdomains_used', 'ftp_accounts_used',
            'cpu_usage_percent', 'memory_used_mb', 'memory_limit_mb',
            'memory_percent', 'recorded_at'
        ]
        # read_only_fields = '__all__'
        read_only_fields = ['id', 'created_at']


class ServiceActionLogSerializer(serializers.ModelSerializer):
    """Serializer for service action logs"""
    
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    performed_by_name = serializers.CharField(source='performed_by.full_name', read_only=True)
    
    class Meta:
        model = ServiceActionLog
        fields = [
            'id', 'action', 'action_display', 'performed_by', 'performed_by_name',
            'is_automatic', 'success', 'error_message', 'details', 'created_at'
        ]
        # read_only_fields = '__all__'
        read_only_fields = ['id', 'created_at']


class ServiceSerializer(serializers.ModelSerializer):
    """Serializer for services"""
    
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    client_email = serializers.EmailField(source='client.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    plan_name = serializers.CharField(read_only=True, allow_null=True)
    is_overdue = serializers.SerializerMethodField()
    
    # Hosting credentials and arbitrary provider config are server-only.
    current_usage = serializers.SerializerMethodField()
    
    class Meta:
        model = Service
        fields = [
            'id', 'client', 'client_name', 'client_email', 'service_type',
            'domain_name', 'label', 'plan_name', 'description', 'status', 'status_display',
            'billing_cycle', 'amount', 'currency', 'next_due_date',
            'auto_renew', 'has_ssl', 'has_backup', 'activated_at',
            'suspended_at', 'current_usage', 'is_overdue',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'activated_at', 'suspended_at']
        
    
    def get_current_usage(self, obj):
        snapshots = getattr(obj, 'latest_usage_prefetch', None)
        latest_usage = (
            snapshots[0] if snapshots else None
        ) if snapshots is not None else obj.usage_history.first()
        if latest_usage:
            return ServiceUsageSerializer(latest_usage).data
        return None
    
    def get_is_overdue(self, obj):
        return obj.is_overdue()


class ServiceChangeRequestSerializer(serializers.ModelSerializer):
    """Serializer for service change requests"""
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    change_type_display = serializers.CharField(source='get_change_type_display', read_only=True)
    
    class Meta:
        model = ServiceChangeRequest
        fields = [
            'id', 'service', 'change_type', 'change_type_display',
            'current_plan_id', 'current_price', 'new_plan_id', 'new_price',
            'invoice', 'status', 'status_display', 'error_message',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ServiceActionSerializer(serializers.Serializer):
    """Serializer for service actions"""
    
    action = serializers.ChoiceField(choices=[
        ('suspend', 'Suspend'),
        ('unsuspend', 'Unsuspend'),
        ('terminate', 'Terminate'),
        ('reboot', 'Reboot'),
        ('start', 'Start'),
        ('stop', 'Stop'),
        ('change_password', 'Change Password'),
    ])
    reason = serializers.CharField(required=False, allow_blank=True)
    new_password = serializers.CharField(required=False, allow_blank=True)


class ServiceChangePackageSerializer(serializers.Serializer):
    """Serializer for changing service package"""
    
    new_plan_id = serializers.IntegerField()

