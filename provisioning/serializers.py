# provisioning/serializers.py

from rest_framework import serializers
from .models import (
    ProvisioningTask, ProvisioningQueue, ProvisioningLog, 
    ProvisioningWebhook, WebhookDelivery
)


class ProvisioningLogSerializer(serializers.ModelSerializer):
    """Serializer for provisioning logs"""
    
    class Meta:
        model = ProvisioningLog
        fields = [
            'id', 'step', 'log_level', 'message', 'duration_ms',
            'request_data', 'response_data', 'created_at'
        ]
        # read_only_fields = '__all__'
        read_only_fields = ['id', 'created_at']


class ProvisioningTaskSerializer(serializers.ModelSerializer):
    """Serializer for provisioning tasks"""
    
    service_label = serializers.CharField(source='service.label', read_only=True)
    service_client = serializers.CharField(source='service.client.email', read_only=True)
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    logs = ProvisioningLogSerializer(many=True, read_only=True)
    
    class Meta:
        model = ProvisioningTask
        fields = [
            'id', 'service', 'service_label', 'service_client', 'order', 'order_item',
            'provider', 'provider_name', 'action', 'action_display', 'adapter_type',
            'priority', 'priority_display', 'payload', 'status', 'status_display',
            'attempt_count', 'max_attempts', 'last_error', 'last_error_code',
            'scheduled_at', 'started_at', 'completed_at', 'result_data',
            'executed_by', 'logs', 'created_at'
        ]
        # read_only_fields = '__all__'
        read_only_fields = ['id', 'created_at']


class CreateProvisioningTaskSerializer(serializers.Serializer):
    """Serializer for creating provisioning tasks"""
    
    service_id = serializers.IntegerField()
    action = serializers.ChoiceField(choices=[
        ('provision', 'Provision'),
        ('suspend', 'Suspend'),
        ('unsuspend', 'Unsuspend'),
        ('terminate', 'Terminate'),
        ('sync_usage', 'Sync Usage'),
    ])
    priority = serializers.IntegerField(default=3, min_value=1, max_value=4)
    scheduled_at = serializers.DateTimeField(required=False)
    payload = serializers.JSONField(required=False, default=dict)


class RetryTaskSerializer(serializers.Serializer):
    """Serializer for retrying a task"""
    
    reset_attempts = serializers.BooleanField(default=False)


class ProvisioningQueueSerializer(serializers.ModelSerializer):
    """Serializer for provisioning queues"""
    
    queue_type_display = serializers.CharField(source='get_queue_type_display', read_only=True)
    
    class Meta:
        model = ProvisioningQueue
        fields = [
            'id', 'queue_name', 'queue_type', 'queue_type_display',
            'total_processed', 'total_succeeded', 'total_failed', 'current_tasks',
            'is_active', 'max_concurrent', 'retry_delay_minutes', 'created_at'
        ]
        read_only_fields = ['total_processed', 'total_succeeded', 'total_failed', 'current_tasks']


class ProvisioningWebhookSerializer(serializers.ModelSerializer):
    """Serializer for provisioning webhooks"""
    
    class Meta:
        model = ProvisioningWebhook
        fields = [
            'id', 'url', 'events', 'secret', 'is_active', 'max_retries',
            'retry_delay_seconds', 'last_sent_at', 'last_status',
            'success_count', 'failure_count', 'created_at'
        ]
        read_only_fields = ['last_sent_at', 'last_status', 'success_count', 'failure_count']


class WebhookDeliverySerializer(serializers.ModelSerializer):
    """Serializer for webhook deliveries"""
    
    class Meta:
        model = WebhookDelivery
        fields = [
            'id', 'webhook', 'task', 'event', 'attempt', 'response_status',
            'success', 'error_message', 'delivered_at'
        ]
        # read_only_fields = '__all__'
        read_only_fields = ['id', 'created_at']


class QueueStatsSerializer(serializers.Serializer):
    """Serializer for queue statistics"""
    
    queued = serializers.IntegerField()
    running = serializers.IntegerField()
    completed = serializers.IntegerField()
    failed = serializers.IntegerField()
    retrying = serializers.IntegerField()
    needs_review = serializers.IntegerField()
    total = serializers.IntegerField()

