# audit/models.py

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey

# ============================================
# AUDIT LOG MODEL
# ============================================

class AuditLog(models.Model):
    """Central audit log for all important actions"""
    
    ACTION_CHOICES = [
        # Authentication
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('login_failed', 'Login Failed'),
        ('password_reset', 'Password Reset'),
        ('password_changed', 'Password Changed'),
        ('email_changed', 'Email Changed'),
        
        # User Management
        ('user_created', 'User Created'),
        ('user_updated', 'User Updated'),
        ('user_deleted', 'User Deleted'),
        ('user_suspended', 'User Suspended'),
        ('user_activated', 'User Activated'),
        ('role_assigned', 'Role Assigned'),
        ('role_removed', 'Role Removed'),
        
        # Orders
        ('order_created', 'Order Created'),
        ('order_updated', 'Order Updated'),
        ('order_cancelled', 'Order Cancelled'),
        ('order_paid', 'Order Paid'),
        
        # Invoices
        ('invoice_created', 'Invoice Created'),
        ('invoice_paid', 'Invoice Paid'),
        ('invoice_cancelled', 'Invoice Cancelled'),
        ('invoice_overdue', 'Invoice Overdue'),
        
        # Payments
        ('payment_initiated', 'Payment Initiated'),
        ('payment_completed', 'Payment Completed'),
        ('payment_failed', 'Payment Failed'),
        ('payment_refunded', 'Payment Refunded'),
        ('webhook_received', 'Webhook Received'),
        
        # Wallet
        ('wallet_credited', 'Wallet Credited'),
        ('wallet_debited', 'Wallet Debited'),
        ('withdrawal_requested', 'Withdrawal Requested'),
        ('withdrawal_approved', 'Withdrawal Approved'),
        ('withdrawal_completed', 'Withdrawal Completed'),
        
        # Services
        ('service_provisioned', 'Service Provisioned'),
        ('service_suspended', 'Service Suspended'),
        ('service_unsuspended', 'Service Unsuspended'),
        ('service_terminated', 'Service Terminated'),
        ('service_upgraded', 'Service Upgraded'),
        ('service_downgraded', 'Service Downgraded'),
        
        # Domains
        ('domain_registered', 'Domain Registered'),
        ('domain_transferred', 'Domain Transferred'),
        ('domain_renewed', 'Domain Renewed'),
        ('dns_record_added', 'DNS Record Added'),
        ('dns_record_updated', 'DNS Record Updated'),
        ('dns_record_deleted', 'DNS Record Deleted'),
        ('nameserver_updated', 'Nameserver Updated'),
        
        # SSL
        ('ssl_issued', 'SSL Issued'),
        ('ssl_renewed', 'SSL Renewed'),
        ('ssl_expired', 'SSL Expired'),
        
        # Tickets
        ('ticket_created', 'Ticket Created'),
        ('ticket_replied', 'Ticket Replied'),
        ('ticket_resolved', 'Ticket Resolved'),
        ('ticket_closed', 'Ticket Closed'),
        ('ticket_assigned', 'Ticket Assigned'),
        
        # Settings
        ('settings_updated', 'Settings Updated'),
        ('gateway_configured', 'Gateway Configured'),
        ('provider_configured', 'Provider Configured'),
        
        # Providers
        ('provider_connection_test', 'Provider Connection Test'),
        ('provider_sync', 'Provider Sync'),
        
        # System
        ('cron_run', 'Cron Job Run'),
        ('system_error', 'System Error'),
        ('api_access', 'API Access'),
    ]
    
    # Actor info
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    actor_email = models.EmailField(blank=True, null=True)
    actor_role = models.CharField(max_length=20, blank=True, null=True)
    actor_ip = models.GenericIPAddressField(blank=True, null=True)
    actor_user_agent = models.TextField(blank=True, null=True)
    
    # Action info
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    entity_type = models.CharField(max_length=100, blank=True, null=True)
    entity_id = models.CharField(max_length=100, blank=True, null=True)
    entity_name = models.CharField(max_length=500, blank=True, null=True)
    
    # Generic relation (optional)
    content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
    object_id = models.CharField(max_length=100, blank=True, null=True)
    content_object = GenericForeignKey('content_type', 'object_id')
    
    # Details
    old_value = models.JSONField(default=dict, blank=True, null=True)
    new_value = models.JSONField(default=dict, blank=True, null=True)
    details = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, null=True)
    
    # Request info
    request_method = models.CharField(max_length=10, blank=True, null=True)
    request_path = models.CharField(max_length=500, blank=True, null=True)
    request_query = models.TextField(blank=True, null=True)
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['actor', '-created_at']),
            models.Index(fields=['action', '-created_at']),
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['created_at']),
            models.Index(fields=['actor_ip']),
        ]
    
    def __str__(self):
        actor_name = self.actor_email or self.actor.email if self.actor else 'System'
        return f"{actor_name} - {self.action} - {self.created_at}"


# ============================================
# LOGIN ATTEMPT MODEL
# ============================================

class LoginAttempt(models.Model):
    """Track login attempts for security"""
    
    email = models.EmailField()
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True, null=True)
    was_successful = models.BooleanField(default=False)
    failure_reason = models.CharField(max_length=255, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', '-created_at']),
            models.Index(fields=['ip_address', '-created_at']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.email} - {'Success' if self.was_successful else 'Failed'} - {self.created_at}"


# ============================================
# API ACCESS LOG MODEL
# ============================================

class APIAccessLog(models.Model):
    """Track API access for monitoring"""
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='api_logs')
    api_key_id = models.IntegerField(blank=True, null=True)
    
    method = models.CharField(max_length=10)
    path = models.CharField(max_length=500)
    query_string = models.TextField(blank=True, null=True)
    
    status_code = models.IntegerField()
    response_time_ms = models.IntegerField()
    
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True, null=True)
    
    request_body_size = models.IntegerField(default=0)
    response_body_size = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['method', 'path']),
            models.Index(fields=['status_code']),
            models.Index(fields=['ip_address']),
        ]
    
    def __str__(self):
        return f"{self.method} {self.path} - {self.status_code} - {self.created_at}"


# ============================================
# SECURITY EVENT MODEL
# ============================================

class SecurityEvent(models.Model):
    """Track security-related events"""
    
    SEVERITY_CHOICES = [
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error'),
        ('critical', 'Critical'),
    ]
    
    EVENT_TYPES = [
        ('suspicious_login', 'Suspicious Login'),
        ('brute_force', 'Brute Force Attempt'),
        ('unauthorized_access', 'Unauthorized Access Attempt'),
        ('sensitive_action', 'Sensitive Action'),
        ('permission_change', 'Permission Change'),
        ('data_export', 'Data Export'),
    ]
    
    event_type = models.CharField(max_length=50, choices=EVENT_TYPES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='warning')
    
    # Who
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='security_events')
    user_email = models.EmailField(blank=True, null=True)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True, null=True)
    
    # Details
    description = models.TextField()
    details = models.JSONField(default=dict, blank=True)
    
    # Resolution
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(blank=True, null=True)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_events')
    resolution_note = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['event_type', 'severity']),
            models.Index(fields=['ip_address']),
            models.Index(fields=['is_resolved']),
        ]
    
    def resolve(self, resolved_by, note=None):
        """Mark security event as resolved"""
        self.is_resolved = True
        self.resolved_at = timezone.now()
        self.resolved_by = resolved_by
        if note:
            self.resolution_note = note
        self.save()
    
    def __str__(self):
        return f"{self.get_event_type_display()} - {self.ip_address} - {self.created_at}"


# ============================================
# DATA EXPORT LOG MODEL
# ============================================

class DataExportLog(models.Model):
    """Track data exports for compliance"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('expired', 'Expired'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='data_exports')
    export_type = models.CharField(max_length=100)  # invoices, services, tickets, etc.
    
    # Filters used
    filters = models.JSONField(default=dict, blank=True)
    
    # File info
    file_url = models.URLField(blank=True, null=True)
    file_size = models.IntegerField(default=0, help_text="File size in bytes")
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)
    
    # Expiry
    expires_at = models.DateTimeField()
    
    # Request info
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['status']),
            models.Index(fields=['expires_at']),
        ]
    
    def mark_completed(self, file_url, file_size):
        """Mark export as completed"""
        self.status = 'completed'
        self.file_url = file_url
        self.file_size = file_size
        self.completed_at = timezone.now()
        self.save()
    
    def mark_failed(self, error):
        """Mark export as failed"""
        self.status = 'failed'
        self.error_message = error
        self.save()
    
    def is_expired(self):
        """Check if export has expired"""
        return timezone.now() > self.expires_at
    
    def __str__(self):
        return f"{self.user.email} - {self.export_type} - {self.status}"


# ============================================
# SYSTEM HEALTH LOG MODEL
# ============================================

class SystemHealthLog(models.Model):
    """Track system health metrics"""
    
    HEALTH_STATUS = [
        ('healthy', 'Healthy'),
        ('degraded', 'Degraded'),
        ('unhealthy', 'Unhealthy'),
    ]
    
    # Metrics
    cpu_percent = models.FloatField()
    memory_percent = models.FloatField()
    disk_percent = models.FloatField()
    database_connections = models.IntegerField()
    redis_connections = models.IntegerField(default=0)
    
    # Queues
    provisioning_queue_size = models.IntegerField(default=0)
    failed_tasks_count = models.IntegerField(default=0)
    
    # API
    requests_last_minute = models.IntegerField(default=0)
    avg_response_time_ms = models.IntegerField(default=0)
    error_rate_percent = models.FloatField(default=0)
    
    # Status
    status = models.CharField(max_length=20, choices=HEALTH_STATUS, default='healthy')
    
    # Details
    details = models.JSONField(default=dict, blank=True)
    
    recorded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['-recorded_at']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Health: {self.status} - {self.recorded_at}"

