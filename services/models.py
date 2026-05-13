# services/models.py

from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from decimal import Decimal

# ============================================
# SERVICE MODEL
# ============================================

class Service(models.Model):
    """Customer services (hosting, VPS, domains, SSL, etc.)"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending Provisioning'),
        ('provisioning', 'Provisioning'),
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('cancellation_requested', 'Cancellation Requested'),
        ('cancelled', 'Cancelled'),
        ('terminated', 'Terminated'),
        ('failed', 'Provisioning Failed'),
        ('expired', 'Expired'),
    ]
    
    # Relations
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='services')
    order_item = models.ForeignKey('orders.OrderItem', on_delete=models.PROTECT, null=True, blank=True, related_name='services')
    order = models.ForeignKey('orders.Order', on_delete=models.PROTECT, null=True, blank=True, related_name='services')
    invoice = models.ForeignKey('billing.Invoice', on_delete=models.PROTECT, null=True, blank=True, related_name='services')
    
    # Product/Plan info
    product_id = models.IntegerField(help_text="ID from catalog.Product")
    plan_id = models.IntegerField(help_text="ID from catalog.Plan")
    provider_id = models.IntegerField(null=True, blank=True, help_text="ID from providers.Provider")
    
    # Service details
    service_type = models.CharField(max_length=50, default='hosting', choices=[
        ('hosting', 'Web Hosting'),
        ('vps', 'VPS Hosting'),
        ('domain', 'Domain Registration'),
        ('ssl', 'SSL Certificate'),
        ('email', 'Email Service'),
        ('backup', 'Backup Service'),
        ('dedicated', 'Dedicated Server'),
        ('other', 'Other Service'),
    ])
    domain_name = models.CharField(max_length=255, blank=True, null=True)
    label = models.CharField(max_length=255, help_text="Display name for the service")
    description = models.TextField(blank=True, null=True)
    
    # Provider identifiers
    provider_identifier = models.CharField(max_length=255, blank=True, null=True, help_text="Provider's internal ID (e.g., DirectAdmin username)")
    provider_package_id = models.CharField(max_length=200, blank=True, null=True, help_text="Package ID from provider")
    
    # Status
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='pending')
    
    # Billing
    billing_cycle = models.CharField(max_length=10, help_text="e.g., 1mo, 12mo, once")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='NGN')
    next_due_date = models.DateTimeField()
    
    # Auto-renewal
    auto_renew = models.BooleanField(default=True, help_text="Automatically renew service")
    
    # Suspension settings
    suspension_reason = models.TextField(blank=True, null=True)
    suspension_scheduled_at = models.DateTimeField(blank=True, null=True, help_text="Scheduled suspension date")
    termination_scheduled_at = models.DateTimeField(blank=True, null=True, help_text="Scheduled termination date")
    
    # Dates
    activated_at = models.DateTimeField(blank=True, null=True)
    suspended_at = models.DateTimeField(blank=True, null=True)
    terminated_at = models.DateTimeField(blank=True, null=True)
    cancelled_at = models.DateTimeField(blank=True, null=True)
    
    # Feature flags
    has_ssl = models.BooleanField(default=False)
    has_backup = models.BooleanField(default=False)
    has_malware_protection = models.BooleanField(default=False)
    has_cdn = models.BooleanField(default=False)
    
    # Metadata
    config = models.JSONField(default=dict, blank=True, help_text="Service configuration")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['client', 'status']),
            models.Index(fields=['provider_identifier']),
            models.Index(fields=['next_due_date']),
            models.Index(fields=['domain_name']),
            models.Index(fields=['service_type']),
        ]
    
    def activate(self):
        """Activate the service"""
        self.status = 'active'
        self.activated_at = timezone.now()
        self.save(update_fields=['status', 'activated_at'])
        
        # Update order if exists
        if self.order:
            self.order.mark_provisioned()
    
    def suspend(self, reason=None, scheduled=False):
        """Suspend the service"""
        self.status = 'suspended'
        self.suspended_at = timezone.now()
        if reason:
            self.suspension_reason = reason
        if scheduled:
            self.suspension_scheduled_at = timezone.now()
        self.save()
    
    def unsuspend(self):
        """Unsuspend the service"""
        self.status = 'active'
        self.suspended_at = None
        self.suspension_reason = None
        self.suspension_scheduled_at = None
        self.save()
    
    def terminate(self):
        """Terminate the service"""
        self.status = 'terminated'
        self.terminated_at = timezone.now()
        self.save()
    
    def request_cancellation(self):
        """Request cancellation (scheduled for end of billing period)"""
        self.status = 'cancellation_requested'
        self.save()
    
    def cancel(self):
        """Cancel the service immediately"""
        self.status = 'cancelled'
        self.cancelled_at = timezone.now()
        self.save()
    
    def renew(self, invoice):
        """Renew the service"""
        self.next_due_date = self.next_due_date + timezone.timedelta(days=self.get_cycle_days())
        self.save()
    
    def get_cycle_days(self):
        """Get number of days in billing cycle"""
        cycle_days = {
            '1mo': 30,
            '3mo': 90,
            '6mo': 180,
            '12mo': 365,
            '24mo': 730,
            'once': 0,
        }
        return cycle_days.get(self.billing_cycle, 30)
    
    def is_overdue(self):
        """Check if service payment is overdue"""
        if self.status == 'active' and self.next_due_date < timezone.now():
            return True
        return False
    
    def needs_suspension(self):
        """Check if service needs to be suspended"""
        if self.status == 'active' and self.suspension_scheduled_at and self.suspension_scheduled_at <= timezone.now():
            return True
        return False
    
    def __str__(self):
        return f"{self.label} - {self.client.email} - {self.status}"


# ============================================
# SERVICE CREDENTIAL MODEL
# ============================================

class ServiceCredential(models.Model):
    """Encrypted service credentials (cPanel login, FTP, etc.)"""
    
    service = models.OneToOneField(Service, on_delete=models.CASCADE, related_name='credentials')
    
    # Access credentials
    username = models.CharField(max_length=255, blank=True, null=True)
    encrypted_password = models.TextField(blank=True, null=True, help_text="Encrypted password")
    encrypted_api_key = models.TextField(blank=True, null=True, help_text="Encrypted API key")
    
    # URLs
    control_panel_url = models.URLField(blank=True, null=True, help_text="cPanel/DirectAdmin login URL")
    ftp_server = models.CharField(max_length=255, blank=True, null=True)
    ftp_port = models.IntegerField(default=21)
    database_host = models.CharField(max_length=255, blank=True, null=True)
    database_name = models.CharField(max_length=255, blank=True, null=True)
    database_user = models.CharField(max_length=255, blank=True, null=True)
    encrypted_database_password = models.TextField(blank=True, null=True)
    
    # Nameservers (for domains)
    nameserver1 = models.CharField(max_length=255, blank=True, null=True)
    nameserver2 = models.CharField(max_length=255, blank=True, null=True)
    nameserver3 = models.CharField(max_length=255, blank=True, null=True)
    nameserver4 = models.CharField(max_length=255, blank=True, null=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['service']),
        ]
    
    def set_password(self, password):
        """Encrypt and store password"""
        if password:
            from cryptography.fernet import Fernet
            from django.conf import settings
            fernet = Fernet(settings.ENCRYPTION_KEY)
            self.encrypted_password = fernet.encrypt(password.encode()).decode()
    
    def get_password(self):
        """Decrypt and return password"""
        if not self.encrypted_password:
            return None
        from cryptography.fernet import Fernet
        from django.conf import settings
        try:
            fernet = Fernet(settings.ENCRYPTION_KEY)
            return fernet.decrypt(self.encrypted_password.encode()).decode()
        except:
            return None
    
    def __str__(self):
        return f"Credentials for {self.service.label}"


# ============================================
# SERVICE USAGE MODEL
# ============================================

class ServiceUsage(models.Model):
    """Service usage snapshots for historical tracking"""
    
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='usage_history')
    
    # Disk usage
    disk_used_mb = models.BigIntegerField(default=0, help_text="MB used")
    disk_limit_mb = models.BigIntegerField(default=0, help_text="MB limit")
    disk_percent = models.FloatField(default=0, help_text="Percentage of disk used")
    
    # Bandwidth usage
    bandwidth_used_mb = models.BigIntegerField(default=0, help_text="MB used")
    bandwidth_limit_mb = models.BigIntegerField(default=0, help_text="MB limit")
    bandwidth_percent = models.FloatField(default=0, help_text="Percentage of bandwidth used")
    
    # Email usage
    email_used = models.IntegerField(default=0)
    email_limit = models.IntegerField(default=0)
    
    # Database usage
    database_used = models.IntegerField(default=0)
    database_limit = models.IntegerField(default=0)
    
    # Addon usage
    addon_domains_used = models.IntegerField(default=0)
    addon_domains_limit = models.IntegerField(default=0)
    subdomains_used = models.IntegerField(default=0)
    subdomains_limit = models.IntegerField(default=0)
    ftp_accounts_used = models.IntegerField(default=0)
    ftp_accounts_limit = models.IntegerField(default=0)
    
    # VPS specific
    cpu_usage_percent = models.FloatField(default=0)
    memory_used_mb = models.BigIntegerField(default=0)
    memory_limit_mb = models.BigIntegerField(default=0)
    memory_percent = models.FloatField(default=0)
    
    # Raw data from provider
    raw_data = models.JSONField(default=dict, blank=True)
    
    # Timestamp
    recorded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['service', '-recorded_at']),
        ]
    
    def calculate_percentages(self):
        """Calculate usage percentages"""
        if self.disk_limit_mb > 0:
            self.disk_percent = (self.disk_used_mb / self.disk_limit_mb) * 100
        if self.bandwidth_limit_mb > 0:
            self.bandwidth_percent = (self.bandwidth_used_mb / self.bandwidth_limit_mb) * 100
        if self.memory_limit_mb > 0:
            self.memory_percent = (self.memory_used_mb / self.memory_limit_mb) * 100
    
    def save(self, *args, **kwargs):
        self.calculate_percentages()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.service.label} - {self.recorded_at.date()}"


# ============================================
# SERVICE ACTION LOG MODEL
# ============================================

class ServiceActionLog(models.Model):
    """Log of all actions performed on a service"""
    
    ACTION_CHOICES = [
        ('provision', 'Provision'),
        ('activate', 'Activate'),
        ('suspend', 'Suspend'),
        ('unsuspend', 'Unsuspend'),
        ('terminate', 'Terminate'),
        ('cancel', 'Cancel'),
        ('renew', 'Renew'),
        ('change_package', 'Change Package'),
        ('change_password', 'Change Password'),
        ('reboot', 'Reboot'),
        ('start', 'Start'),
        ('stop', 'Stop'),
        ('migration', 'Migration'),
        ('backup', 'Backup'),
        ('restore', 'Restore'),
    ]
    
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='action_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    
    # Who performed the action
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    is_automatic = models.BooleanField(default=False, help_text="Performed by system/cron")
    
    # Result
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True, null=True)
    
    # Details
    details = models.JSONField(default=dict, blank=True)
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['service', '-created_at']),
            models.Index(fields=['action']),
        ]
    
    def __str__(self):
        return f"{self.service.label} - {self.action} - {self.created_at}"


# ============================================
# SERVICE SUSPENSION HISTORY MODEL
# ============================================

class ServiceSuspension(models.Model):
    """History of service suspensions"""
    
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='suspensions')
    suspended_at = models.DateTimeField(auto_now_add=True)
    unsuspended_at = models.DateTimeField(blank=True, null=True)
    reason = models.TextField()
    suspended_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='suspensions')
    
    duration_hours = models.IntegerField(default=0, help_text="Suspension duration in hours")
    
    class Meta:
        ordering = ['-suspended_at']
    
    def unsuspend(self, unsuspended_by=None):
        """Mark suspension as ended"""
        self.unsuspended_at = timezone.now()
        if unsuspended_by:
            self.suspended_by = unsuspended_by
        self.save()
    
    def __str__(self):
        return f"{self.service.label} - Suspended at {self.suspended_at}"


# ============================================
# SERVICE UPGRADE/DOWNGRADE REQUEST MODEL
# ============================================

class ServiceChangeRequest(models.Model):
    """Requests to upgrade or downgrade service package"""
    
    CHANGE_TYPES = [
        ('upgrade', 'Upgrade'),
        ('downgrade', 'Downgrade'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name='change_requests')
    change_type = models.CharField(max_length=10, choices=CHANGE_TYPES)
    
    # Package info
    current_plan_id = models.IntegerField()
    current_price = models.DecimalField(max_digits=12, decimal_places=2)
    
    new_plan_id = models.IntegerField()
    new_price = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Invoice for prorated amount
    invoice = models.ForeignKey('billing.Invoice', on_delete=models.SET_NULL, null=True, blank=True)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Metadata
    processed_at = models.DateTimeField(blank=True, null=True)
    processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='processed_changes')
    error_message = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def approve(self, processed_by=None):
        """Approve change request"""
        self.status = 'approved'
        if processed_by:
            self.processed_by = processed_by
        self.save()
    
    def complete(self):
        """Mark change as completed"""
        self.status = 'completed'
        self.processed_at = timezone.now()
        self.save()
        
        # Update service with new plan
        self.service.plan_id = self.new_plan_id
        self.service.amount = self.new_price
        self.service.save()
    
    def fail(self, error):
        """Mark change as failed"""
        self.status = 'failed'
        self.error_message = error
        self.save()
    
    def __str__(self):
        return f"{self.service.label} - {self.change_type} to plan {self.new_plan_id}"