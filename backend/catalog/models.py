# catalog/models.py

from django.db import models
from django.utils.text import slugify
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone

# ============================================
# PRODUCT CATEGORY
# ============================================

class ProductCategory(models.Model):
    """Product categories like Hosting, Domains, SSL, etc."""
    
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)
    description = models.TextField(blank=True, null=True)
    icon = models.CharField(max_length=50, blank=True, null=True, help_text="FontAwesome or Lucide icon name")
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name_plural = "Product Categories"
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['is_active']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
    
    def __str__(self):
        return self.name


# ============================================
# PRODUCT
# ============================================

class Product(models.Model):
    """Products like Web Hosting, VPS Hosting, Domain Registration, etc."""
    
    PRODUCT_TYPES = [
        ('shared_hosting', 'Shared Hosting'),
        ('wordpress_hosting', 'WordPress Hosting'),
        ('vps', 'VPS Hosting'),
        ('dedicated', 'Dedicated Server'),
        ('domain', 'Domain Registration'),
        ('ssl', 'SSL Certificate'),
        ('email', 'Business Email'),
        ('backup', 'Backup Service'),
        ('migration', 'Migration Service'),
        ('custom', 'Custom Service'),
    ]
    
    # Basic info
    category = models.ForeignKey(ProductCategory, on_delete=models.CASCADE, related_name='products')
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, blank=True)
    description = models.TextField(blank=True, null=True)
    product_type = models.CharField(max_length=50, choices=PRODUCT_TYPES, default='shared_hosting')
    
    # Status
    status = models.CharField(max_length=20, default='active', choices=[
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('coming_soon', 'Coming Soon'),
        ('discontinued', 'Discontinued'),
    ])
    is_public = models.BooleanField(default=True, help_text="Show on order page")
    sort_order = models.IntegerField(default=0)
    
    # Feature image
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    features = models.JSONField(default=list, blank=True, help_text="List of product features")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['sort_order', 'name']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['product_type']),
            models.Index(fields=['status']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
    
    def __str__(self):
        return self.name


# ============================================
# PLAN
# ============================================

class Plan(models.Model):
    """Plans/Packages under a product (e.g., Starter, Business, Pro)"""
    
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='plans')
    name = models.CharField(max_length=100)
    slug = models.SlugField(blank=True)
    description = models.TextField(blank=True, null=True)
    
    # Pricing (base)
    currency = models.CharField(max_length=3, default='NGN')
    base_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Status
    status = models.CharField(max_length=20, default='active', choices=[
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('coming_soon', 'Coming Soon'),
    ])
    is_public = models.BooleanField(default=True)
    is_popular = models.BooleanField(default=False, help_text="Mark as popular/recommended")
    sort_order = models.IntegerField(default=0)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['sort_order', 'base_price']
        unique_together = ['product', 'slug']
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['status']),
            models.Index(fields=['is_popular']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.product.name} - {self.name}"


# ============================================
# PLAN FEATURE
# ============================================

class PlanFeature(models.Model):
    """Features for each plan (disk space, bandwidth, emails, etc.)"""
    
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name='features')
    label = models.CharField(max_length=100, help_text="e.g., Disk Space, Bandwidth, Email Accounts")
    value = models.CharField(max_length=100, help_text="e.g., 10 GB, 100 GB, Unlimited")
    is_highlighted = models.BooleanField(default=False, help_text="Show as key feature")
    sort_order = models.IntegerField(default=0)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['sort_order', 'label']
        indexes = [
            models.Index(fields=['plan', 'is_highlighted']),
        ]
    
    def __str__(self):
        return f"{self.plan.name}: {self.label} - {self.value}"


# ============================================
# PLAN BILLING CYCLE
# ============================================

class PlanBillingCycle(models.Model):
    """Pricing for different billing cycles (monthly, quarterly, annually)"""
    
    CYCLE_CHOICES = [
        ('1mo', '1 Month'),
        ('3mo', '3 Months'),
        ('6mo', '6 Months'),
        ('12mo', '12 Months'),
        ('24mo', '24 Months'),
        ('36mo', '36 Months'),
        ('once', 'One Time'),
    ]
    
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name='billing_cycles')
    cycle_key = models.CharField(max_length=10, choices=CYCLE_CHOICES)
    label = models.CharField(max_length=50, blank=True)
    months = models.PositiveIntegerField(help_text="Number of months for this cycle")
    
    # Pricing
    price = models.DecimalField(max_digits=12, decimal_places=2)
    regular_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, help_text="Original price before discount")
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    setup_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False, help_text="Default cycle shown on order page")
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['months']
        unique_together = ['plan', 'cycle_key']
        indexes = [
            models.Index(fields=['plan', 'is_active']),
            models.Index(fields=['cycle_key']),
        ]
    
    def save(self, *args, **kwargs):
        if not self.label:
            cycle_labels = {
                '1mo': 'Monthly',
                '3mo': 'Quarterly',
                '6mo': 'Semi-Annually',
                '12mo': 'Annually',
                '24mo': 'Biennially',
                '36mo': 'Triennially',
                'once': 'One Time',
            }
            self.label = cycle_labels.get(self.cycle_key, self.cycle_key)
        super().save(*args, **kwargs)
    
    @property
    def monthly_price(self):
        """Calculate monthly equivalent price"""
        if self.months > 0:
            return self.price / self.months
        return self.price
    
    def __str__(self):
        return f"{self.plan.name} - {self.label} (₦{self.price})"


# ============================================
# PLAN PROVIDER MAPPING
# ============================================

class PlanProviderMapping(models.Model):
    """Maps Octalve plans to provider packages (DirectAdmin, cPanel, etc.)"""
    
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name='provider_mappings')
    provider_id = models.IntegerField(help_text="ID from providers.Provider model")
    adapter_type = models.CharField(max_length=100, help_text="e.g., DirectAdminAdapter")
    provider_package_id = models.CharField(max_length=200, help_text="Package ID from provider")
    provider_package_name = models.CharField(max_length=200, blank=True, null=True)
    server_group = models.CharField(max_length=100, blank=True, null=True, help_text="Server group for provisioning")
    
    # Configuration
    config = models.JSONField(default=dict, blank=True, help_text="Additional provider-specific config")
    is_active = models.BooleanField(default=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['plan', 'provider_id']
        unique_together = ['plan', 'provider_id', 'adapter_type']
        indexes = [
            models.Index(fields=['plan', 'is_active']),
            models.Index(fields=['provider_id', 'adapter_type']),
        ]
    
    def __str__(self):
        return f"{self.plan.name} -> {self.provider_package_name or self.provider_package_id}"


# =============================================================
# A1/A2: Supplier-backed commercial publishing
# =============================================================

class CatalogOfferDraft(models.Model):
    """Admin's editable, unpublished quote for an Octalve retail package.

    Editing a draft never changes the currently published plan or invoices.
    """
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='offer_drafts')
    provider_package = models.ForeignKey(
        'providers.ProviderPackage', on_delete=models.PROTECT, related_name='offer_drafts'
    )
    plan = models.ForeignKey(Plan, null=True, blank=True, on_delete=models.PROTECT, related_name='offer_drafts')
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=20, default='draft', choices=[
        ('draft', 'Draft'), ('published', 'Published'), ('superseded', 'Superseded')
    ])
    created_by = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_cloud_offers'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']


class PublishedCatalogOffer(models.Model):
    """Immutable commercial offer snapshot for audit and checkout provenance."""
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name='published_versions')
    revision = models.PositiveIntegerField()
    snapshot = models.JSONField(default=dict)
    published_by = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='published_cloud_offers'
    )
    published_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-published_at']
        unique_together = [('plan', 'revision')]
