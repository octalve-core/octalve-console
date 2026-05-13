# payments/models.py

from django.db import models
from django.conf import settings
from django.utils import timezone
from cryptography.fernet import Fernet
from django.conf import settings

class PaymentGateway(models.Model):
    """Payment gateway configuration"""
    
    GATEWAY_CODES = [
        ('paystack', 'Paystack'),
        ('flutterwave', 'Flutterwave'),
        ('bank_transfer', 'Bank Transfer'),
        ('wallet', 'Wallet Balance'),
        ('manual', 'Manual Payment'),
        ('crypto', 'Cryptocurrency'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('test', 'Test Mode'),
    ]
    
    code = models.CharField(max_length=50, unique=True, choices=GATEWAY_CODES)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='test')
    test_mode = models.BooleanField(default=True)
    
    # Credentials (encrypted)
    public_key = models.TextField(blank=True, null=True)
    encrypted_secret_key = models.TextField(blank=True, null=True)
    encrypted_webhook_secret = models.TextField(blank=True, null=True)
    
    # Configuration
    config = models.JSONField(default=dict, blank=True)
    sort_order = models.IntegerField(default=0)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['sort_order', 'name']
        indexes = [
            models.Index(fields=['code', 'status']),
        ]
    
    def get_secret_key(self):
        """Decrypt and return secret key"""
        if not self.encrypted_secret_key:
            return None
        try:
            fernet = Fernet(settings.ENCRYPTION_KEY)
            return fernet.decrypt(self.encrypted_secret_key.encode()).decode()
        except:
            return None
    
    def set_secret_key(self, value):
        """Encrypt and store secret key"""
        if value:
            fernet = Fernet(settings.ENCRYPTION_KEY)
            self.encrypted_secret_key = fernet.encrypt(value.encode()).decode()
        else:
            self.encrypted_secret_key = None
    
    def get_webhook_secret(self):
        """Decrypt and return webhook secret"""
        if not self.encrypted_webhook_secret:
            return None
        try:
            fernet = Fernet(settings.ENCRYPTION_KEY)
            return fernet.decrypt(self.encrypted_webhook_secret.encode()).decode()
        except:
            return None
    
    def set_webhook_secret(self, value):
        """Encrypt and store webhook secret"""
        if value:
            fernet = Fernet(settings.ENCRYPTION_KEY)
            self.encrypted_webhook_secret = fernet.encrypt(value.encode()).decode()
        else:
            self.encrypted_webhook_secret = None
    
    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"


class Transaction(models.Model):
    """Payment transactions"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('successful', 'Successful'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
        ('refunded', 'Refunded'),
        ('manual_review', 'Manual Review Required'),
    ]
    
    TYPE_CHOICES = [
        ('payment', 'Payment'),
        ('refund', 'Refund'),
        ('deposit', 'Deposit'),
        ('withdrawal', 'Withdrawal'),
    ]
    
    # Relations
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='transactions')
    invoice = models.ForeignKey('billing.Invoice', on_delete=models.PROTECT, null=True, blank=True, related_name='transactions')
    gateway = models.ForeignKey(PaymentGateway, on_delete=models.PROTECT, null=True, blank=True)
    
    # Transaction details
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='payment')
    reference = models.CharField(max_length=200, unique=True)
    provider_reference = models.CharField(max_length=200, blank=True, null=True)
    
    # Financial
    currency = models.CharField(max_length=3, default='NGN')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_amount = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Payment details
    payment_method = models.CharField(max_length=100, blank=True, null=True)
    card_last4 = models.CharField(max_length=4, blank=True, null=True)
    card_type = models.CharField(max_length=50, blank=True, null=True)
    
    # Webhook data
    webhook_payload = models.JSONField(default=dict, blank=True)
    webhook_verified = models.BooleanField(default=False)
    
    # Customer info
    customer_name = models.CharField(max_length=255, blank=True, null=True)
    customer_email = models.EmailField(blank=True, null=True)
    customer_phone = models.CharField(max_length=20, blank=True, null=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    paid_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['reference']),
            models.Index(fields=['client', 'status']),
            models.Index(fields=['invoice', 'status']),
            models.Index(fields=['-created_at']),
        ]
    
    def mark_successful(self):
        """Mark transaction as successful"""
        self.status = 'successful'
        self.paid_at = timezone.now()
        self.save()
        
        # Update invoice if exists
        if self.invoice:
            self.invoice.mark_paid(self)
    
    def mark_failed(self, reason=None):
        """Mark transaction as failed"""
        self.status = 'failed'
        if reason:
            self.metadata['failure_reason'] = reason
        self.save()
    
    def __str__(self):
        return f"{self.reference} - {self.amount} {self.currency} - {self.status}"


class PaymentIntent(models.Model):
    """Payment intent before checkout"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('expired', 'Expired'),
        ('failed', 'Failed'),
    ]
    
    invoice = models.ForeignKey('billing.Invoice', on_delete=models.CASCADE, related_name='payment_intents')
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    gateway = models.ForeignKey(PaymentGateway, on_delete=models.CASCADE)
    
    reference = models.CharField(max_length=200, unique=True)
    authorization_url = models.URLField(blank=True, null=True)
    access_code = models.CharField(max_length=200, blank=True, null=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='NGN')
    
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    
    class Meta:
        indexes = [
            models.Index(fields=['reference']),
            models.Index(fields=['invoice', 'status']),
        ]
    
    def is_expired(self):
        """Check if payment intent has expired"""
        return timezone.now() > self.expires_at
    
    def __str__(self):
        return f"{self.reference} - {self.amount} - {self.status}"


class WebhookEvent(models.Model):
    """Store webhook events for processing"""
    
    gateway = models.ForeignKey(PaymentGateway, on_delete=models.CASCADE)
    event_id = models.CharField(max_length=200, unique=True)
    event_type = models.CharField(max_length=100)
    
    payload = models.JSONField()
    headers = models.JSONField(default=dict)
    
    is_verified = models.BooleanField(default=False)
    is_processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(blank=True, null=True)
    error_message = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['gateway', 'is_processed']),
            models.Index(fields=['event_id']),
        ]
    
    def mark_processed(self, success=True, error=None):
        """Mark webhook as processed"""
        self.is_processed = True
        self.processed_at = timezone.now()
        if error:
            self.error_message = error
        self.save()
    
    def __str__(self):
        return f"{self.gateway.code} - {self.event_type} - {self.event_id}"