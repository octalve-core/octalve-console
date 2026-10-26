# provisioning/models.py

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
import json

# ============================================
# PROVISIONING TASK MODEL
# ============================================

class ProvisioningTask(models.Model):
    """Queue for provisioning tasks"""
    
    ACTION_CHOICES = [
        ('provision', 'Provision'),
        ('suspend', 'Suspend'),
        ('unsuspend', 'Unsuspend'),
        ('terminate', 'Terminate'),
        ('change_package', 'Change Package'),
        ('change_password', 'Change Password'),
        ('reboot', 'Reboot'),
        ('start', 'Start'),
        ('stop', 'Stop'),
        ('sync_usage', 'Sync Usage'),
        ('sync_details', 'Sync Details'),
    ]
    
    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('retrying', 'Retrying'),
        ('cancelled', 'Cancelled'),
        ('needs_review', 'Needs Review'),
        ('pending_confirmation', 'Pending Confirmation'),
    ]
    
    PRIORITY_CHOICES = [
        (1, 'Critical'),
        (2, 'High'),
        (3, 'Normal'),
        (4, 'Low'),
    ]
    
    # Relations
    service = models.ForeignKey('services.Service', on_delete=models.CASCADE, related_name='provisioning_tasks')
    order = models.ForeignKey('orders.Order', on_delete=models.CASCADE, null=True, blank=True, related_name='provisioning_tasks')
    order_item = models.ForeignKey('orders.OrderItem', on_delete=models.CASCADE, null=True, blank=True, related_name='provisioning_tasks')
    provider = models.ForeignKey('providers.Provider', on_delete=models.CASCADE, null=True, blank=True, related_name='provisioning_tasks')
    
    # Task details
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    adapter_type = models.CharField(max_length=100)
    priority = models.IntegerField(choices=PRIORITY_CHOICES, default=3)
    
    # Payload data
    payload = models.JSONField(default=dict, help_text="Data needed for provisioning")
    
    # Status
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='queued')
    
    # Retry configuration
    attempt_count = models.IntegerField(default=0)
    max_attempts = models.IntegerField(default=3)
    last_error = models.TextField(blank=True, null=True)
    last_error_code = models.CharField(max_length=50, blank=True, null=True)
    
    # Scheduling
    scheduled_at = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    
    # Results
    result_data = models.JSONField(default=dict, blank=True, help_text="Provisioning result data")
    
    # Execution tracking
    executed_by = models.CharField(max_length=100, default='system', help_text="system, cron, admin, or worker_id")
    lock_key = models.CharField(max_length=255, blank=True, null=True, unique=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['priority', 'scheduled_at', 'created_at']
        indexes = [
            models.Index(fields=['status', 'scheduled_at']),
            models.Index(fields=['service', 'status']),
            models.Index(fields=['provider', 'status']),
            models.Index(fields=['lock_key']),
            models.Index(fields=['-created_at']),
        ]
    
    def mark_running(self, executed_by=None):
        """Mark task as running"""
        self.status = 'running'
        self.started_at = timezone.now()
        if executed_by:
            self.executed_by = executed_by
        self.save(update_fields=['status', 'started_at', 'executed_by', 'updated_at'])
    
    def mark_completed(self, result_data=None):
        """Mark a verified read-only task completed; never grant hosting authority.

        Mutating host actions must go through the future durable settlement and
        provider-confirmation worker, which has NOT been approved. A queued task
        or an arbitrary success result cannot activate or unsuspend a service.
        """
        if self.action not in ('sync_usage', 'sync_details'):
            raise ValueError("Provider-changing task completion requires the audited reconciliation worker.")
        self.status = 'completed'
        self.completed_at = timezone.now()
        if result_data:
            self.result_data = result_data
        self.save(update_fields=['status', 'completed_at', 'result_data', 'updated_at'])

        # No implicit service state mutation; future accepted workers own it.
    
    def mark_failed(self, error, error_code=None):
        """Never blindly retry a potentially applied provider mutation."""
        if self.action not in ("sync_usage", "sync_details"):
            self.attempt_count += 1
            self.last_error = "Provider-changing operation needs manual reconciliation."
            self.last_error_code = "REMOTE_OUTCOME_UNKNOWN"
            self.status = "needs_review"
            self.save(update_fields=["attempt_count", "last_error", "last_error_code",
                                     "status", "updated_at"])
            return
        self.attempt_count += 1
        self.last_error = str(error)
        self.last_error_code = error_code
        
        if self.attempt_count >= self.max_attempts:
            self.status = 'failed'
        else:
            self.status = 'retrying'
            # Exponential backoff: 1min, 5min, 15min
            backoff_minutes = [1, 5, 15]
            backoff = backoff_minutes[min(self.attempt_count - 1, len(backoff_minutes) - 1)]
            self.scheduled_at = timezone.now() + timezone.timedelta(minutes=backoff)
        
        self.save(update_fields=['attempt_count', 'last_error', 'last_error_code', 'status', 'scheduled_at', 'updated_at'])
    
    def mark_cancelled(self):
        """Mark task as cancelled"""
        self.status = 'cancelled'
        self.save(update_fields=['status', 'updated_at'])
    
    def mark_needs_review(self, reason=None):
        """Mark task as needing manual review"""
        self.status = 'needs_review'
        if reason:
            self.metadata['review_reason'] = reason
        self.save(update_fields=['status', 'metadata', 'updated_at'])
    
    def can_retry(self):
        """Check if task can be retried"""
        return (self.action in ("sync_usage", "sync_details")
                and self.attempt_count < self.max_attempts
                and self.status in ['failed', 'retrying'])
    
    def is_overdue(self):
        """Check if task is overdue"""
        if self.status in ['queued', 'retrying'] and self.scheduled_at < timezone.now() - timezone.timedelta(hours=1):
            return True
        return False
    
    def __str__(self):
        return f"{self.action} - Service {self.service.id} - {self.status}"


# ============================================
# PROVISIONING QUEUE MODEL
# ============================================

class ProvisioningQueue(models.Model):
    """Queue management and statistics"""
    
    QUEUE_TYPES = [
        ('high', 'High Priority'),
        ('normal', 'Normal Priority'),
        ('low', 'Low Priority'),
        ('bulk', 'Bulk Operations'),
    ]
    
    queue_name = models.CharField(max_length=50, unique=True)
    queue_type = models.CharField(max_length=20, choices=QUEUE_TYPES, default='normal')
    
    # Statistics
    total_processed = models.BigIntegerField(default=0)
    total_succeeded = models.BigIntegerField(default=0)
    total_failed = models.BigIntegerField(default=0)
    
    # Current status
    current_tasks = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    
    # Worker configuration
    max_concurrent = models.IntegerField(default=5, help_text="Maximum concurrent tasks")
    retry_delay_minutes = models.IntegerField(default=5)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['queue_type']
    
    def increment_processed(self, succeeded=True):
        """Increment statistics"""
        self.total_processed += 1
        if succeeded:
            self.total_succeeded += 1
        else:
            self.total_failed += 1
        self.save()
    
    def __str__(self):
        return f"{self.queue_name} - {self.current_tasks} tasks"


# ============================================
# PROVISIONING LOG MODEL
# ============================================

class ProvisioningLog(models.Model):
    """Detailed log of provisioning steps"""
    
    task = models.ForeignKey(ProvisioningTask, on_delete=models.CASCADE, related_name='logs')
    
    # Log details
    step = models.CharField(max_length=100)
    log_level = models.CharField(max_length=20, default='info', choices=[
        ('debug', 'Debug'),
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error'),
    ])
    message = models.TextField()
    
    # Technical details
    request_data = models.JSONField(default=dict, blank=True)
    response_data = models.JSONField(default=dict, blank=True)
    duration_ms = models.IntegerField(default=0)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['task', '-created_at']),
            models.Index(fields=['log_level']),
        ]
    
    def __str__(self):
        return f"{self.task.id} - {self.step} - {self.log_level}"


# ============================================
# PROVISIONING WEBHOOK MODEL
# ============================================

class ProvisioningWebhook(models.Model):
    """Webhooks for provisioning events to notify external systems"""
    
    EVENT_CHOICES = [
        ('task.created', 'Task Created'),
        ('task.completed', 'Task Completed'),
        ('task.failed', 'Task Failed'),
        ('service.provisioned', 'Service Provisioned'),
        ('service.suspended', 'Service Suspended'),
        ('service.terminated', 'Service Terminated'),
    ]
    
    # Configuration
    url = models.URLField()
    events = models.JSONField(default=list, help_text="List of events to send")
    secret = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    # Retry settings
    max_retries = models.IntegerField(default=3)
    retry_delay_seconds = models.IntegerField(default=60)
    
    # Statistics
    last_sent_at = models.DateTimeField(blank=True, null=True)
    last_status = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    failure_count = models.IntegerField(default=0)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Webhook to {self.url[:50]}"


# ============================================
# PROVISIONING WEBHOOK DELIVERY MODEL
# ============================================

class WebhookDelivery(models.Model):
    """Record of webhook delivery attempts"""
    
    webhook = models.ForeignKey(ProvisioningWebhook, on_delete=models.CASCADE, related_name='deliveries')
    task = models.ForeignKey(ProvisioningTask, on_delete=models.CASCADE, null=True, blank=True)
    event = models.CharField(max_length=100)
    payload = models.JSONField()
    
    # Delivery details
    attempt = models.IntegerField(default=1)
    response_status = models.IntegerField(blank=True, null=True)
    response_body = models.TextField(blank=True, null=True)
    
    success = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, null=True)
    
    # Timing
    delivered_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-delivered_at']
        indexes = [
            models.Index(fields=['webhook', 'success']),
            models.Index(fields=['task']),
        ]
    
    def __str__(self):
        return f"Delivery to {self.webhook.url[:30]} - Success: {self.success}"
