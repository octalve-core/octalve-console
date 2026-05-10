# domains/models.py

from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
import uuid

# ============================================
# DOMAIN MODEL
# ============================================

class Domain(models.Model):
    """Customer domains"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending Registration'),
        ('active', 'Active'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
        ('suspended', 'Suspended'),
        ('transfer_pending', 'Transfer Pending'),
        ('transfer_complete', 'Transfer Complete'),
    ]
    
    REGISTRATION_TYPES = [
        ('register', 'New Registration'),
        ('transfer', 'Transfer'),
        ('renewal', 'Renewal'),
    ]
    
    # Relations
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='domains')
    service = models.OneToOneField('services.Service', on_delete=models.SET_NULL, null=True, blank=True, related_name='domain')
    order_item = models.ForeignKey('orders.OrderItem', on_delete=models.SET_NULL, null=True, blank=True)
    provider = models.ForeignKey('providers.Provider', on_delete=models.SET_NULL, null=True, blank=True)
    
    # Domain details
    domain_name = models.CharField(max_length=255, unique=True)
    tld = models.CharField(max_length=50, help_text="Top Level Domain (e.g., .com, .ng)")
    
    # Registration
    registration_type = models.CharField(max_length=20, choices=REGISTRATION_TYPES, default='register')
    registrar = models.CharField(max_length=200, blank=True, null=True)
    provider_domain_id = models.CharField(max_length=200, blank=True, null=True, help_text="Provider's domain ID")
    
    # Status
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending')
    is_active = models.BooleanField(default=True)
    
    # Dates
    registration_date = models.DateTimeField(default=timezone.now)
    expiry_date = models.DateTimeField()
    next_due_date = models.DateTimeField()
    
    # Auto-renewal
    auto_renew = models.BooleanField(default=True)
    auto_renew_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # DNSSEC
    dnssec_enabled = models.BooleanField(default=False)
    dnssec_key = models.TextField(blank=True, null=True)
    
    # EPP/Transfer code
    epp_code = models.CharField(max_length=255, blank=True, null=True)
    epp_code_encrypted = models.TextField(blank=True, null=True)
    
    # Contacts
    registrant_contact = models.JSONField(default=dict, blank=True, help_text="Registrant contact info")
    admin_contact = models.JSONField(default=dict, blank=True)
    tech_contact = models.JSONField(default=dict, blank=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['domain_name']
        indexes = [
            models.Index(fields=['domain_name']),
            models.Index(fields=['client', 'status']),
            models.Index(fields=['expiry_date']),
            models.Index(fields=['tld']),
        ]
    
    def set_epp_code(self, code):
        """Encrypt and store EPP code"""
        if code:
            from cryptography.fernet import Fernet
            from django.conf import settings
            fernet = Fernet(settings.ENCRYPTION_KEY)
            self.epp_code_encrypted = fernet.encrypt(code.encode()).decode()
            self.epp_code = None
    
    def get_epp_code(self):
        """Decrypt and return EPP code"""
        if self.epp_code_encrypted:
            from cryptography.fernet import Fernet
            from django.conf import settings
            try:
                fernet = Fernet(settings.ENCRYPTION_KEY)
                return fernet.decrypt(self.epp_code_encrypted.encode()).decode()
            except:
                pass
        return self.epp_code
    
    def days_until_expiry(self):
        """Days remaining until expiry"""
        if self.expiry_date:
            delta = self.expiry_date - timezone.now()
            return max(0, delta.days)
        return 0
    
    def is_expiring_soon(self, days=30):
        """Check if domain is expiring soon"""
        return self.days_until_expiry() <= days and self.days_until_expiry() > 0
    
    def is_expired(self):
        """Check if domain is expired"""
        return self.expiry_date and self.expiry_date < timezone.now()
    
    def renew(self, years=1):
        """Renew domain"""
        from datetime import timedelta
        self.expiry_date += timedelta(days=years * 365)
        self.next_due_date = self.expiry_date
        self.status = 'active'
        self.save()
    
    def __str__(self):
        return self.domain_name


# ============================================
# DOMAIN NAMESERVER MODEL
# ============================================

class DomainNameserver(models.Model):
    """Custom nameservers for domain"""
    
    domain = models.ForeignKey(Domain, on_delete=models.CASCADE, related_name='nameservers')
    hostname = models.CharField(max_length=255)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    sort_order = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['sort_order']
        unique_together = ['domain', 'hostname']
    
    def __str__(self):
        return f"{self.domain.domain_name} - {self.hostname}"


# ============================================
# DNS RECORD MODEL
# ============================================

class DNSRecord(models.Model):
    """DNS records for domain"""
    
    RECORD_TYPES = [
        ('A', 'A - IPv4 Address'),
        ('AAAA', 'AAAA - IPv6 Address'),
        ('CNAME', 'CNAME - Canonical Name'),
        ('MX', 'MX - Mail Exchange'),
        ('TXT', 'TXT - Text Record'),
        ('SRV', 'SRV - Service Record'),
        ('CAA', 'CAA - Certificate Authority'),
        ('NS', 'NS - Nameserver'),
        ('PTR', 'PTR - Pointer Record'),
        ('SOA', 'SOA - Start of Authority'),
    ]
    
    domain = models.ForeignKey(Domain, on_delete=models.CASCADE, related_name='dns_records')
    
    # Record details
    record_type = models.CharField(max_length=10, choices=RECORD_TYPES)
    name = models.CharField(max_length=255, help_text="Subdomain (e.g., www, mail, @ for root)")
    value = models.TextField(help_text="Record value (IP, domain, text, etc.)")
    ttl = models.IntegerField(default=3600, validators=[MinValueValidator(60), MaxValueValidator(86400)], help_text="Time to live in seconds")
    
    # MX specific
    priority = models.IntegerField(default=0, blank=True, null=True, help_text="Priority for MX records")
    
    # SRV specific
    service = models.CharField(max_length=50, blank=True, null=True, help_text="Service name for SRV records")
    protocol = models.CharField(max_length=50, blank=True, null=True, help_text="Protocol for SRV records")
    port = models.IntegerField(blank=True, null=True, help_text="Port for SRV records")
    weight = models.IntegerField(default=0, blank=True, null=True, help_text="Weight for SRV records")
    
    # Status
    is_active = models.BooleanField(default=True)
    provider_record_id = models.CharField(max_length=200, blank=True, null=True, help_text="Provider's record ID")
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['record_type', 'name']
        indexes = [
            models.Index(fields=['domain', 'record_type']),
            models.Index(fields=['domain', 'name']),
        ]
    
    def __str__(self):
        return f"{self.domain.domain_name} - {self.record_type} {self.name}"


# ============================================
# TLD PRICING MODEL
# ============================================

class TLDPricing(models.Model):
    """Pricing for Top Level Domains"""
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('coming_soon', 'Coming Soon'),
        ('discontinued', 'Discontinued'),
    ]
    
    # TLD details
    tld = models.CharField(max_length=50, unique=True, help_text=".com, .ng, .org, etc.")
    description = models.TextField(blank=True, null=True)
    
    # Pricing
    register_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="1 year registration")
    transfer_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="1 year transfer")
    renewal_price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Annual renewal")
    
    # Additional costs
    restore_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, help_text="Expired domain restore")
    redemption_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, help_text="Redemption period restore")
    epp_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="EPP code transfer fee")
    
    # Grace periods
    grace_period_days = models.IntegerField(default=30, help_text="Grace period after expiry")
    redemption_period_days = models.IntegerField(default=30, help_text="Redemption period days")
    
    # Requirements
    requires_dnssec = models.BooleanField(default=False)
    requires_id_protection = models.BooleanField(default=False)
    requires_trademark = models.BooleanField(default=False)
    
    # Local presence required
    local_presence_required = models.BooleanField(default=False, help_text="Requires local presence")
    countries_allowed = models.JSONField(default=list, blank=True, help_text="Allowed countries for local presence")
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    is_premium = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['sort_order', 'tld']
        verbose_name = "TLD Pricing"
        verbose_name_plural = "TLD Pricing"
    
    def __str__(self):
        return f"{self.tld} - ₦{self.register_price}"


# ============================================
# DOMAIN SEARCH LOG
# ============================================

class DomainSearchLog(models.Model):
    """Log domain searches"""
    
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='domain_searches')
    session_key = models.CharField(max_length=40, blank=True, null=True)
    
    query = models.CharField(max_length=255)
    tld = models.CharField(max_length=50, blank=True, null=True)
    
    # Results
    is_available = models.BooleanField(default=False)
    price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Source
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    searched_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-searched_at']
        indexes = [
            models.Index(fields=['query', 'searched_at']),
            models.Index(fields=['client']),
        ]
    
    def __str__(self):
        return f"{self.query} - Available: {self.is_available}"


# ============================================
# SSL CERTIFICATE MODEL
# ============================================

class SSLCertificate(models.Model):
    """SSL certificates for domains"""
    
    CERTIFICATE_TYPES = [
        ('dv', 'Domain Validation'),
        ('ov', 'Organization Validation'),
        ('ev', 'Extended Validation'),
        ('wildcard', 'Wildcard SSL'),
        ('multi_domain', 'Multi-Domain SSL'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending Issuance'),
        ('active', 'Active'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
        ('reissued', 'Reissued'),
    ]
    
    # Relations
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='ssl_certificates')
    domain = models.ForeignKey(Domain, on_delete=models.SET_NULL, null=True, blank=True, related_name='ssl_certificates')
    service = models.ForeignKey('services.Service', on_delete=models.SET_NULL, null=True, blank=True, related_name='ssl_certificate')
    provider = models.ForeignKey('providers.Provider', on_delete=models.SET_NULL, null=True, blank=True)
    
    # Certificate details
    common_name = models.CharField(max_length=255, help_text="Primary domain")
    san_domains = models.JSONField(default=list, blank=True, help_text="Subject Alternative Names")
    certificate_type = models.CharField(max_length=20, choices=CERTIFICATE_TYPES, default='dv')
    
    # Issuer
    issuer = models.CharField(max_length=255, blank=True, null=True)
    provider_certificate_id = models.CharField(max_length=200, blank=True, null=True)
    
    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Dates
    issued_at = models.DateTimeField(blank=True, null=True)
    expires_at = models.DateTimeField()
    next_due_date = models.DateTimeField()
    
    # Auto-renewal
    auto_renew = models.BooleanField(default=True)
    
    # Validation
    validation_method = models.CharField(max_length=50, blank=True, null=True, choices=[
        ('dns', 'DNS Validation'),
        ('http', 'HTTP Validation'),
        ('email', 'Email Validation'),
    ])
    validation_data = models.JSONField(default=dict, blank=True)
    
    # Certificate data (encrypted)
    encrypted_private_key = models.TextField(blank=True, null=True)
    encrypted_certificate = models.TextField(blank=True, null=True)
    encrypted_ca_bundle = models.TextField(blank=True, null=True)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['client', 'status']),
            models.Index(fields=['expires_at']),
            models.Index(fields=['common_name']),
        ]
    
    def days_until_expiry(self):
        """Days remaining until expiry"""
        if self.expires_at:
            delta = self.expires_at - timezone.now()
            return max(0, delta.days)
        return 0
    
    def install(self, private_key, certificate, ca_bundle=None):
        """Store certificate data"""
        from cryptography.fernet import Fernet
        from django.conf import settings
        fernet = Fernet(settings.ENCRYPTION_KEY)
        
        self.encrypted_private_key = fernet.encrypt(private_key.encode()).decode()
        self.encrypted_certificate = fernet.encrypt(certificate.encode()).decode()
        if ca_bundle:
            self.encrypted_ca_bundle = fernet.encrypt(ca_bundle.encode()).decode()
        self.save()
    
    def __str__(self):
        return f"{self.common_name} - {self.status}"

