# wallet/models.py

from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal

# ============================================
# WALLET MODEL
# ============================================

class Wallet(models.Model):
    """Customer wallet for credits"""
    
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='wallet')
    currency = models.CharField(max_length=3, default='NGN')
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    is_active = models.BooleanField(default=True)
    
    # Settings
    auto_pay_enabled = models.BooleanField(default=False, help_text="Auto-pay invoices from wallet")
    auto_pay_threshold = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Minimum balance required for auto-pay")
    low_balance_threshold = models.DecimalField(max_digits=12, decimal_places=2, default=1000, help_text="Send alert when balance falls below this")
    
    # Dates
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['balance']),
        ]
    
    def add_balance(self, amount, description, reference=None, created_by=None, metadata=None):
        """Internal credit with durable, wallet-scoped idempotency and row locking."""
        from .ledger_authority import post_wallet_entry
        balance, _created = post_wallet_entry(
            self, direction="credit", amount=amount, description=description,
            reference=reference, created_by=created_by, metadata=metadata,
        )
        return balance

    def deduct_balance(self, amount, description, reference=None, created_by=None, metadata=None):
        """Internal debit; never performs a blind read/modify/write."""
        from .ledger_authority import post_wallet_entry
        balance, _created = post_wallet_entry(
            self, direction="debit", amount=amount, description=description,
            reference=reference, created_by=created_by, metadata=metadata,
        )
        return balance

    def _send_low_balance_alert(self):
        """Send low balance notification"""
        # This would trigger a notification
        from notifications.utils import send_notification
        send_notification(
            user=self.user,
            template_key='wallet_low_balance',
            context={
                'balance': self.balance,
                'threshold': self.low_balance_threshold
            }
        )
    
    def can_auto_pay(self, amount):
        """Check if wallet can auto-pay an invoice"""
        return self.auto_pay_enabled and self.balance >= amount and self.balance >= self.auto_pay_threshold
    
    def __str__(self):
        return f"{self.user.email} - {self.currency} {self.balance}"


# ============================================
# WALLET LEDGER MODEL
# ============================================

class WalletLedger(models.Model):
    """Wallet transaction ledger - complete history of all wallet movements"""
    
    TRANSACTION_TYPES = [
        ('credit', 'Credit'),
        ('debit', 'Debit'),
        ('deposit', 'Deposit'),
        ('invoice_payment', 'Invoice Payment'),
        ('refund', 'Refund'),
        ('manual_adjustment', 'Manual Adjustment'),
        ('referral_bonus', 'Referral Bonus'),
        ('cashback', 'Cashback'),
        ('fee', 'Fee'),
        ('expired', 'Expired Credit'),
    ]
    
    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='ledger')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='wallet_ledger')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    balance_before = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=500)
    reference = models.CharField(max_length=100, blank=True, null=True)
    invoice_id = models.IntegerField(blank=True, null=True)
    transaction_id = models.IntegerField(blank=True, null=True, help_text="Related payment transaction ID")
    
    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='wallet_actions'
    )
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['wallet', '-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['transaction_type']),
            models.Index(fields=['reference']),
            models.Index(fields=['invoice_id']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.transaction_type} - {self.amount}"


# ============================================
# WITHDRAWAL REQUEST MODEL
# ============================================

class WithdrawalRequest(models.Model):
    """Customer withdrawal requests from wallet"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
        ('rejected', 'Rejected'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='withdrawal_requests')
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(100)])
    currency = models.CharField(max_length=3, default='NGN')
    
    # Bank details
    bank_name = models.CharField(max_length=100)
    bank_code = models.CharField(max_length=10, blank=True, null=True)
    account_name = models.CharField(max_length=200)
    account_number = models.CharField(max_length=20)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Processing info
    processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='processed_withdrawals')
    processed_at = models.DateTimeField(blank=True, null=True)
    reference = models.CharField(max_length=100, blank=True, null=True, unique=True)
    
    # Rejection reason
    rejection_reason = models.TextField(blank=True, null=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['reference']),
        ]
    
    def approve(self, processed_by=None):
        """Approve withdrawal request"""
        self.status = 'approved'
        self.processed_by = processed_by
        self.processed_at = timezone.now()
        self.save()
    
    def complete(self, reference=None):
        """Mark withdrawal as completed"""
        self.status = 'completed'
        if reference:
            self.reference = reference
        self.save()
        
        # Create ledger entry for the deduction
        self.user.wallet.deduct_balance(
            amount=self.amount,
            description=f"Withdrawal to {self.bank_name} - {self.account_number}",
            reference=self.reference,
            created_by=self.processed_by,
            metadata={'withdrawal_id': self.id}
        )
    
    def reject(self, reason, processed_by=None):
        """Reject withdrawal request"""
        self.status = 'rejected'
        self.rejection_reason = reason
        self.processed_by = processed_by
        self.processed_at = timezone.now()
        self.save()
    
    def cancel(self):
        """Cancel withdrawal request by user"""
        if self.status == 'pending':
            self.status = 'cancelled'
            self.save()
    
    def __str__(self):
        return f"{self.user.email} - {self.amount} - {self.status}"


# ============================================
# DEPOSIT REQUEST MODEL
# ============================================

class DepositRequest(models.Model):
    """Manual deposit requests (bank transfer, etc.)"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending Verification'),
        ('verified', 'Verified'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='deposit_requests')
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(100)])
    currency = models.CharField(max_length=3, default='NGN')
    
    # Payment method
    payment_method = models.CharField(max_length=50, default='bank_transfer')
    reference = models.CharField(max_length=100, unique=True)
    
    # Uploaded proof
    receipt_image = models.ImageField(upload_to='deposits/', blank=True, null=True)
    receipt_number = models.CharField(max_length=100, blank=True, null=True)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Verification
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_deposits')
    verified_at = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['reference']),
        ]
    
    def verify(self, verified_by=None, notes=None):
        """Verify and complete deposit"""
        self.status = 'verified'
        self.verified_by = verified_by
        self.verified_at = timezone.now()
        if notes:
            self.notes = notes
        self.save()
        self.complete()
    
    def complete(self):
        """Complete deposit - add funds to wallet"""
        self.status = 'completed'
        self.save()
        
        # Add funds to wallet
        self.user.wallet.add_balance(
            amount=self.amount,
            description=f"Deposit via {self.get_payment_method_display()} - {self.reference}",
            reference=self.reference,
            created_by=self.verified_by,
            metadata={'deposit_id': self.id}
        )
    
    def fail(self, reason=None):
        """Mark deposit as failed"""
        self.status = 'failed'
        if reason:
            self.notes = reason
        self.save()
    
    def __str__(self):
        return f"{self.user.email} - {self.amount} - {self.status}"
