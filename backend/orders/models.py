from decimal import Decimal
# orders/models.py

from django.db import models, transaction
from octalve_backend.document_sequence import lock_document_sequence
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
import secrets
import string

# ============================================
# ORDER MODEL
# ============================================

class Order(models.Model):
    """Customer orders for products/services"""
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_payment', 'Pending Payment'),
        ('paid', 'Paid'),
        ('ready_for_provisioning', 'Ready for Provisioning'),
        ('provisioning', 'Provisioning'),
        ('provisioned', 'Provisioned'),
        ('cancelled', 'Cancelled'),
        ('failed', 'Failed'),
        ('needs_review', 'Needs Review'),
    ]
    
    SOURCE_CHOICES = [
        ('web', 'Web Order'),
        ('admin', 'Admin Created'),
        ('api', 'API Order'),
        ('renewal', 'Auto Renewal'),
        ('migration', 'Migration'),
    ]
    
    # Basic info
    order_number = models.CharField(max_length=20, unique=True, editable=False)
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='orders')
    
    # Status
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='draft')
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='web')
    
    # Financial
    currency = models.CharField(max_length=3, default='NGN')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Coupon
    coupon_code = models.CharField(max_length=50, blank=True, null=True)
    coupon_discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Dates
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(blank=True, null=True)
    provisioned_at = models.DateTimeField(blank=True, null=True)
    
    # Metadata
    notes = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order_number']),
            models.Index(fields=['client', 'status']),
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['-created_at']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.order_number:
            with transaction.atomic():
                lock_document_sequence(1)
                self.order_number = self.generate_order_number()
                return super().save(*args, **kwargs)
        return super().save(*args, **kwargs)
    
    def generate_order_number(self):
        """Generate unique order number: ORD-2024-00001"""
        prefix = f"ORD-{timezone.now().strftime('%Y')}-"
        last_order = Order.objects.filter(order_number__startswith=prefix).order_by('-order_number').first()
        if last_order:
            last_num = int(last_order.order_number.split('-')[-1])
            new_num = last_num + 1
        else:
            new_num = 1
        return f"{prefix}{new_num:05d}"
    
    def calculate_totals(self):
        """Recalculate order totals"""
        items = self.items.all()
        self.subtotal = sum(item.subtotal for item in items)
        self.total = self.subtotal - self.discount_total + self.tax_total
        self.save(update_fields=['subtotal', 'total'])
    
    def mark_paid(self):
        """Mark order as paid"""
        self.status = 'paid'
        self.paid_at = timezone.now()
        self.save(update_fields=['status', 'paid_at'])
    
    def mark_provisioned(self):
        """Mark order as provisioned"""
        self.status = 'provisioned'
        self.provisioned_at = timezone.now()
        self.save(update_fields=['status', 'provisioned_at'])
    
    def cancel(self):
        """Cancel the order"""
        self.status = 'cancelled'
        self.save(update_fields=['status'])
    
    def __str__(self):
        return f"{self.order_number} - {self.client.email}"


# ============================================
# ORDER ITEM MODEL
# ============================================

class OrderItem(models.Model):
    """Individual items within an order"""
    
    ITEM_TYPES = [
        ('hosting', 'Hosting Service'),
        ('domain', 'Domain Registration'),
        ('ssl', 'SSL Certificate'),
        ('email', 'Email Service'),
        ('backup', 'Backup Service'),
        ('vps', 'VPS Service'),
        ('addon', 'Add-on Service'),
        ('migration', 'Migration Service'),
    ]
    
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    
    # Product info
    product_id = models.IntegerField(help_text="ID from catalog.Product")
    plan_id = models.IntegerField(help_text="ID from catalog.Plan")
    billing_cycle_id = models.IntegerField(help_text="ID from catalog.PlanBillingCycle")
    
    # Item details
    item_type = models.CharField(max_length=20, choices=ITEM_TYPES, default='hosting')
    description = models.CharField(max_length=500)
    
    # Domain specific (if domain order)
    domain_name = models.CharField(max_length=255, blank=True, null=True)
    
    # Pricing
    quantity = models.IntegerField(default=1, validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Billing info
    cycle_key = models.CharField(max_length=10)
    months = models.PositiveIntegerField()
    
    # Provider mapping (for provisioning)
    provider_package_id = models.CharField(max_length=200, blank=True, null=True)
    
    # Metadata
    config = models.JSONField(default=dict, blank=True, help_text="Item configuration (e.g., nameservers, etc.)")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['id']
        indexes = [
            models.Index(fields=['order', 'item_type']),
            models.Index(fields=['product_id', 'plan_id']),
        ]
    
    def save(self, *args, **kwargs):
        self.subtotal = self.unit_price * self.quantity
        super().save(*args, **kwargs)
        self.order.calculate_totals()
    
    def __str__(self):
        return f"{self.order.order_number} - {self.description}"


# ============================================
# COUPON MODEL
# ============================================

class Coupon(models.Model):
    """Discount coupons for orders"""
    
    DISCOUNT_TYPES = [
        ('percentage', 'Percentage (%)'),
        ('fixed', 'Fixed Amount'),
    ]
    
    # Basic info
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    
    # Discount
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPES, default='percentage')
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    
    # Usage limits
    max_uses = models.IntegerField(default=1, help_text="Maximum number of times this coupon can be used")
    used_count = models.IntegerField(default=0)
    max_uses_per_client = models.IntegerField(default=1, help_text="Maximum uses per client")
    
    # Requirements
    min_order_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    applicable_products = models.JSONField(default=list, blank=True, help_text="List of product IDs this coupon applies to")
    applicable_plans = models.JSONField(default=list, blank=True, help_text="List of plan IDs this coupon applies to")
    
    # Dates
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    
    # Status
    is_active = models.BooleanField(default=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['is_active', 'starts_at', 'ends_at']),
        ]
    
    def is_valid(self, client=None, order_amount=None, product_ids=None, plan_ids=None):
        """Check if coupon is valid for use"""
        now = timezone.now()
        
        if not self.is_active:
            return False, "Coupon is inactive"
        
        if now < self.starts_at:
            return False, "Coupon not yet available"
        
        if now > self.ends_at:
            return False, "Coupon has expired"
        
        if self.used_count >= self.max_uses:
            return False, "Coupon usage limit reached"
        
        if self.min_order_amount and order_amount and order_amount < self.min_order_amount:
            return False, f"Minimum order amount of {self.min_order_amount} required"
        
        if self.applicable_products and (not product_ids or
                any(str(product) not in {str(p) for p in self.applicable_products}
                    for product in product_ids)):
            return False, "Coupon is not valid for this product"
        if self.applicable_plans and (not plan_ids or
                any(str(plan) not in {str(p) for p in self.applicable_plans}
                    for plan in plan_ids)):
            return False, "Coupon is not valid for this plan"

        if client and self.max_uses_per_client:
            from orders.models import CouponRedemption
            client_uses = CouponRedemption.objects.filter(coupon=self, client=client).count()
            if client_uses >= self.max_uses_per_client:
                return False, "You have already used this coupon"
        
        return True, "Valid"
    
    def calculate_discount(self, amount):
        """Calculate discount amount"""
        if self.discount_type == 'percentage':
            return (amount * (self.discount_value / 100)).quantize(Decimal('0.01'))
        else:
            return min(self.discount_value, amount)
    
    def __str__(self):
        return f"{self.code} - {self.discount_value}{'%' if self.discount_type == 'percentage' else ''}"


# ============================================
# COUPON REDEMPTION MODEL
# ============================================

class CouponRedemption(models.Model):
    """Track coupon usage per order"""
    
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='redemptions')
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='coupon_redemptions')
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='coupon_redemptions')
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2)
    redeemed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['coupon', 'order']
        indexes = [
            models.Index(fields=['coupon', 'client']),
        ]
    
    def __str__(self):
        return f"{self.coupon.code} - {self.order.order_number}"


# ============================================
# CART MODEL (for unauthenticated/guest carts)
# ============================================

class Cart(models.Model):
    """Shopping cart for guest or logged-in users"""
    
    session_key = models.CharField(max_length=40, unique=True, null=True, blank=True)
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='carts')
    
    items = models.JSONField(default=list, help_text="List of cart items")
    coupon_code = models.CharField(max_length=50, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['session_key']),
            models.Index(fields=['client']),
        ]
    
    def get_total(self):
        """Calculate cart total"""
        total = 0
        for item in self.items:
            total += item.get('price', 0) * item.get('quantity', 1)
        return total
    
    def __str__(self):
        return f"Cart - {self.session_key or self.client.email if self.client else 'Guest'}"
