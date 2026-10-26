# billing/models.py

from django.db import models, transaction
from octalve_backend.document_sequence import lock_document_sequence
from django.conf import settings
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal

# ============================================
# INVOICE MODEL
# ============================================

class Invoice(models.Model):
    """Customer invoices for orders and renewals"""
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('unpaid', 'Unpaid'),
        ('partially_paid', 'Partially Paid'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('void', 'Void'),
        ('cancelled', 'Cancelled'),
        ('refunded', 'Refunded'),
    ]
    
    # Basic info
    invoice_number = models.CharField(max_length=20, unique=True, editable=False)
    order = models.ForeignKey('orders.Order', on_delete=models.PROTECT, null=True, blank=True, related_name='invoices')
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='invoices')
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unpaid')
    
    # Financial
    currency = models.CharField(max_length=3, default='NGN')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_due = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Dates
    issue_date = models.DateTimeField(default=timezone.now)
    due_date = models.DateTimeField()
    paid_at = models.DateTimeField(blank=True, null=True)
    
    # Metadata
    notes = models.TextField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-issue_date']
        indexes = [
            models.Index(fields=['invoice_number']),
            models.Index(fields=['client', 'status']),
            models.Index(fields=['due_date', 'status']),
            models.Index(fields=['-issue_date']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.invoice_number:
            with transaction.atomic():
                lock_document_sequence(2)
                self.invoice_number = self.generate_invoice_number()
                self.amount_due = self.total - self.amount_paid
                return super().save(*args, **kwargs)
        self.amount_due = self.total - self.amount_paid
        return super().save(*args, **kwargs)
    
    def generate_invoice_number(self):
        """Generate unique invoice number: INV-2024-00001"""
        prefix = f"INV-{timezone.now().strftime('%Y')}-"
        last_invoice = Invoice.objects.filter(invoice_number__startswith=prefix).order_by('-invoice_number').first()
        if last_invoice:
            last_num = int(last_invoice.invoice_number.split('-')[-1])
            new_num = last_num + 1
        else:
            new_num = 1
        return f"{prefix}{new_num:05d}"
    
    def calculate_totals(self):
        """Recalculate invoice totals"""
        items = self.items.all()
        self.subtotal = sum(item.subtotal for item in items)
        self.total = self.subtotal - self.discount_total + self.tax_total
        self.save(update_fields=['subtotal', 'total'])
    
    @classmethod
    def create_from_order(cls, order):
        """Create invoice from an order"""
        invoice = cls.objects.create(
            order=order,
            client=order.client,
            currency=order.currency,
            subtotal=order.subtotal,
            discount_total=order.discount_total,
            total=order.total,
            due_date=timezone.now() + timezone.timedelta(days=7),
            notes=order.notes,
            metadata={"billing_contact": (
                dict(order.metadata.get("billing_contact", {}))
                if isinstance(order.metadata, dict) else {}
            )},
        )
        
        # Copy order items to invoice items
        for order_item in order.items.all():
            InvoiceItem.objects.create(
                invoice=invoice,
                description=order_item.description,
                product_id=order_item.product_id,
                plan_id=order_item.plan_id,
                service_id=None,
                domain_name=order_item.domain_name,
                quantity=order_item.quantity,
                unit_price=order_item.unit_price,
                subtotal=order_item.subtotal,
                period_start=timezone.now(),
                period_end=timezone.now() + timezone.timedelta(days=order_item.months * 30)
            )
        
        return invoice
    
    @classmethod
    def create_renewal_invoice(cls, service):
        """Create renewal invoice for a service"""
        from services.models import Service
        
        invoice = cls.objects.create(
            client=service.client,
            subtotal=service.amount,
            total=service.amount,
            due_date=timezone.now() + timezone.timedelta(days=7),
            metadata={'type': 'renewal', 'service_id': service.id}
        )
        
        InvoiceItem.objects.create(
            invoice=invoice,
            description=f"Renewal of {service.label} ({service.billing_cycle})",
            product_id=service.product_id,
            plan_id=service.plan_id,
            service_id=service.id,
            quantity=1,
            unit_price=service.amount,
            subtotal=service.amount,
            period_start=service.next_due_date,
            period_end=service.next_due_date + timezone.timedelta(days=30)
        )
        
        return invoice
    
    def mark_paid(self, transaction=None):
        """Mark invoice as paid"""
        self.status = 'paid'
        self.amount_paid = self.total
        self.amount_due = 0
        self.paid_at = timezone.now()
        self.save()
        
        # Update order if exists
        if self.order and self.order.status == 'pending_payment':
            self.order.mark_paid()
    
    def apply_payment(self, amount):
        """Apply a payment to this invoice"""
        self.amount_paid += Decimal(str(amount))
        self.amount_due = self.total - self.amount_paid
        
        if self.amount_due <= 0:
            self.mark_paid()
        elif self.amount_paid > 0:
            self.status = 'partially_paid'
        
        self.save()
    
    def is_overdue(self):
        """Check if invoice is overdue"""
        if self.status == 'unpaid' and timezone.now() > self.due_date:
            if self.status != 'overdue':
                self.status = 'overdue'
                self.save(update_fields=['status'])
            return True
        return False
    
    def __str__(self):
        return f"{self.invoice_number} - {self.client.email} - {self.status}"


# ============================================
# INVOICE ITEM MODEL
# ============================================

class InvoiceItem(models.Model):
    """Individual items within an invoice"""
    
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    
    # Item details
    description = models.CharField(max_length=500)
    product_id = models.IntegerField(blank=True, null=True)
    plan_id = models.IntegerField(blank=True, null=True)
    service_id = models.IntegerField(blank=True, null=True, help_text="Related service ID")
    domain_name = models.CharField(max_length=255, blank=True, null=True)
    
    # Pricing
    quantity = models.IntegerField(default=1, validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Period
    period_start = models.DateTimeField()
    period_end = models.DateTimeField()
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['id']
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['service_id']),
        ]
    
    def save(self, *args, **kwargs):
        self.subtotal = self.unit_price * self.quantity
        super().save(*args, **kwargs)
        self.invoice.calculate_totals()
    
    def __str__(self):
        return f"{self.invoice.invoice_number} - {self.description}"


# ============================================
# TAX MODEL
# ============================================

class Tax(models.Model):
    """Tax rates for different countries/states"""
    
    name = models.CharField(max_length=100)
    rate = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(0)])
    country = models.CharField(max_length=2)
    state = models.CharField(max_length=100, blank=True, null=True)
    is_inclusive = models.BooleanField(default=False, help_text="Is tax included in price?")
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['country', 'state']
        indexes = [
            models.Index(fields=['country', 'is_active']),
        ]
    
    @classmethod
    def calculate_tax(cls, amount, country, state=None):
        """Calculate tax for given amount and location"""
        tax = cls.objects.filter(country=country, is_active=True)
        if state:
            tax = tax.filter(models.Q(state=state) | models.Q(state__isnull=True))
        else:
            tax = tax.filter(state__isnull=True)
        
        tax = tax.first()
        if tax:
            if tax.is_inclusive:
                # Tax is already included in price
                tax_amount = amount - (amount / (1 + tax.rate/100))
            else:
                tax_amount = amount * (tax.rate / 100)
            return tax_amount
        return 0
    
    def __str__(self):
        location = f"{self.country}"
        if self.state:
            location += f" - {self.state}"
        return f"{self.name} ({self.rate}%) - {location}"


# ============================================
# QUOTE MODEL
# ============================================

class Quote(models.Model):
    """Quotes/estimates for customers before order"""
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('accepted', 'Accepted'),
        ('expired', 'Expired'),
        ('converted', 'Converted to Order'),
        ('declined', 'Declined'),
    ]
    
    # Basic info
    quote_number = models.CharField(max_length=20, unique=True, editable=False)
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='quotes')
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Financial
    currency = models.CharField(max_length=3, default='NGN')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Dates
    issued_at = models.DateTimeField(default=timezone.now)
    valid_until = models.DateTimeField()
    accepted_at = models.DateTimeField(blank=True, null=True)
    
    # Metadata
    notes = models.TextField(blank=True, null=True)
    items_data = models.JSONField(default=list, help_text="Stored items at quote creation")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-issued_at']
        indexes = [
            models.Index(fields=['quote_number']),
            models.Index(fields=['client', 'status']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.quote_number:
            self.quote_number = self.generate_quote_number()
        super().save(*args, **kwargs)
    
    def generate_quote_number(self):
        """Generate unique quote number: QTE-2024-00001"""
        prefix = f"QTE-{timezone.now().strftime('%Y')}-"
        last_quote = Quote.objects.filter(quote_number__startswith=prefix).order_by('-quote_number').first()
        if last_quote:
            last_num = int(last_quote.quote_number.split('-')[-1])
            new_num = last_num + 1
        else:
            new_num = 1
        return f"{prefix}{new_num:05d}"
    
    def convert_to_order(self):
        """Convert quote to an order"""
        from orders.models import Order, OrderItem
        from catalog.models import Plan, PlanBillingCycle
        
        order = Order.objects.create(
            client=self.client,
            source='web',
            status='pending_payment',
            notes=f"Converted from quote {self.quote_number}"
        )
        
        for item_data in self.items_data:
            OrderItem.objects.create(
                order=order,
                product_id=item_data['product_id'],
                plan_id=item_data['plan_id'],
                billing_cycle_id=item_data['billing_cycle_id'],
                item_type=item_data.get('item_type', 'hosting'),
                description=item_data['description'],
                domain_name=item_data.get('domain_name', ''),
                quantity=item_data.get('quantity', 1),
                unit_price=item_data['unit_price'],
                cycle_key=item_data['cycle_key'],
                months=item_data['months'],
                config=item_data.get('config', {})
            )
        
        self.status = 'converted'
        self.save()
        
        return order
    
    def __str__(self):
        return f"{self.quote_number} - {self.client.email}"

