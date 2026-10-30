# settings_registry/models.py

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
import json

# ============================================
# SETTING GROUP MODEL
# ============================================

class SettingGroup(models.Model):
    """Groups for organizing settings"""
    
    GROUP_KEYS = [
        ('general', 'General'),
        ('security', 'Security'),
        ('social_login', 'Social Login'),
        ('tax', 'Tax'),
        ('mail', 'Mail'),
        ('tickets', 'Tickets'),
        ('cron', 'Cron Jobs'),
        ('credits', 'Credits'),
        ('theme', 'Theme'),
        ('invoices', 'Invoices'),
        ('other', 'Other'),
        ('providers', 'Providers'),
        ('api', 'API Keys'),
        ('notifications', 'Notifications'),
        ('compliance', 'Compliance'),
    ]
    
    key = models.CharField(max_length=50, unique=True, choices=GROUP_KEYS)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    icon = models.CharField(max_length=50, blank=True, null=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['sort_order', 'name']
        indexes = [
            models.Index(fields=['key']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return self.name


# ============================================
# SETTING MODEL
# ============================================

class Setting(models.Model):
    """Dynamic system settings"""
    
    DATA_TYPES = [
        ('string', 'String'),
        ('text', 'Text'),
        ('integer', 'Integer'),
        ('float', 'Float'),
        ('boolean', 'Boolean'),
        ('json', 'JSON'),
        ('email', 'Email'),
        ('url', 'URL'),
        ('password', 'Password (Encrypted)'),
        ('file', 'File'),
    ]
    
    group = models.ForeignKey(SettingGroup, on_delete=models.CASCADE, related_name='settings')
    key = models.CharField(max_length=100)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    
    # Value storage
    data_type = models.CharField(max_length=20, choices=DATA_TYPES, default='string')
    value = models.TextField(blank=True, null=True)
    value_encrypted = models.TextField(blank=True, null=True, help_text="For sensitive values")
    default_value = models.TextField(blank=True, null=True)
    
    # Validation
    validation_rules = models.JSONField(default=dict, blank=True, help_text="e.g., {'min': 0, 'max': 100, 'regex': '^[a-z]+$'}")
    
    # UI
    placeholder = models.CharField(max_length=255, blank=True, null=True)
    options = models.JSONField(default=dict, blank=True, help_text="For select fields: {'choices': [{'value': 'opt1', 'label': 'Option 1'}]}")
    is_required = models.BooleanField(default=False)
    is_encrypted = models.BooleanField(default=False)
    is_deprecated = models.BooleanField(default=False)
    
    # Visibility
    is_public = models.BooleanField(default=False, help_text="Visible to clients")
    sort_order = models.IntegerField(default=0)
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['sort_order', 'key']
        unique_together = ['group', 'key']
        indexes = [
            models.Index(fields=['group', 'key']),
            models.Index(fields=['is_public']),
            models.Index(fields=['is_deprecated']),
        ]
    
    def get_value(self):
        """Get decrypted value if encrypted"""
        if self.is_encrypted and self.value_encrypted:
            from cryptography.fernet import Fernet
            from django.conf import settings
            try:
                fernet = Fernet(settings.ENCRYPTION_KEY)
                return fernet.decrypt(self.value_encrypted.encode()).decode()
            except:
                return self.default_value
        
        if self.value is not None:
            if self.data_type == 'boolean':
                return self.value.lower() in ('true', '1', 'yes', 'on')
            elif self.data_type == 'integer':
                return int(self.value) if self.value else None
            elif self.data_type == 'float':
                return float(self.value) if self.value else None
            elif self.data_type == 'json':
                return json.loads(self.value) if self.value else {}
        
        return self.value or self.default_value
    
    def set_value(self, value):
        """Set value with encryption if needed"""
        if self.is_encrypted and value:
            from cryptography.fernet import Fernet
            from django.conf import settings
            fernet = Fernet(settings.ENCRYPTION_KEY)
            self.value_encrypted = fernet.encrypt(str(value).encode()).decode()
            self.value = None
        else:
            if self.data_type == 'json' and isinstance(value, (dict, list)):
                self.value = json.dumps(value)
            elif self.data_type == 'boolean':
                self.value = 'true' if value else 'false'
            else:
                self.value = str(value) if value is not None else ''
            self.value_encrypted = None
        
        self.save()
    
    def __str__(self):
        return f"{self.group.key}.{self.key}"


# ============================================
# SETTING CHANGE LOG MODEL
# ============================================

class SettingChangeLog(models.Model):
    """Audit log for setting changes"""
    
    setting = models.ForeignKey(Setting, on_delete=models.CASCADE, related_name='change_logs')
    changed_by = models.ForeignKey('accounts.CustomUser', on_delete=models.SET_NULL, null=True, blank=True)
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-changed_at']
        indexes = [
            models.Index(fields=['setting', '-changed_at']),
            models.Index(fields=['changed_by']),
        ]
    
    def __str__(self):
        return f"{self.setting.key} changed by {self.changed_by} at {self.changed_at}"


# ============================================
# EMAIL TEMPLATE MODEL
# ============================================

class EmailTemplate(models.Model):
    """Email templates for system notifications"""
    
    CATEGORY_CHOICES = [
        ('auth', 'Authentication'),
        ('billing', 'Billing & Invoices'),
        ('support', 'Support Tickets'),
        ('provisioning', 'Provisioning'),
        ('domains', 'Domains'),
        ('system', 'System'),
        ('marketing', 'Marketing'),
    ]
    
    key = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='system')
    description = models.TextField(blank=True, null=True)
    
    # Content
    subject = models.CharField(max_length=500)
    subject_variables = models.JSONField(default=list, blank=True, help_text="List of available variables")
    body_html = models.TextField(help_text="HTML email body")
    body_text = models.TextField(help_text="Plain text email body")
    variables = models.JSONField(default=dict, blank=True, help_text="Variable documentation")
    
    # Status
    is_active = models.BooleanField(default=True)
    is_system = models.BooleanField(default=False, help_text="System templates cannot be deleted")
    
    # Metadata
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['category', 'name']
        indexes = [
            models.Index(fields=['key']),
            models.Index(fields=['category']),
            models.Index(fields=['is_active']),
        ]
    
    def render_subject(self, context):
        """Render subject with context variables"""
        subject = self.subject
        for key, value in context.items():
            subject = subject.replace(f'{{{{ {key} }}}}', str(value))
        return subject
    
    def render_html(self, context):
        """Render HTML body with context variables"""
        html = self.body_html
        for key, value in context.items():
            html = html.replace(f'{{{{ {key} }}}}', str(value))
        return html
    
    def render_text(self, context):
        """Render text body with context variables"""
        text = self.body_text
        for key, value in context.items():
            text = text.replace(f'{{{{ {key} }}}}', str(value))
        return text
    
    def __str__(self):
        return self.name


# ============================================
# BRANDING SETTINGS MODEL
# ============================================

class BrandingSettings(models.Model):
    """Company branding settings"""
    
    # Company info
    company_name = models.CharField(max_length=200, default='Octalve')
    company_logo = models.ImageField(upload_to='branding/', blank=True, null=True)
    company_favicon = models.ImageField(upload_to='branding/', blank=True, null=True)
    company_email = models.EmailField(blank=True, null=True)
    company_phone = models.CharField(max_length=50, blank=True, null=True)
    company_address = models.TextField(blank=True, null=True)
    company_website = models.URLField(blank=True, null=True)
    
    # Colors
    primary_color = models.CharField(max_length=7, default='#4F46E5', help_text="Primary brand color")
    secondary_color = models.CharField(max_length=7, default='#10B981', help_text="Secondary brand color")
    accent_color = models.CharField(max_length=7, default='#F59E0B', help_text="Accent color")
    
    # Email branding
    email_logo = models.ImageField(upload_to='branding/emails/', blank=True, null=True)
    email_footer = models.TextField(blank=True, null=True, help_text="Footer text for emails")
    
    # Invoice branding
    invoice_logo = models.ImageField(upload_to='branding/invoices/', blank=True, null=True)
    invoice_footer = models.TextField(blank=True, null=True, help_text="Footer text for invoices")
    invoice_notes = models.TextField(blank=True, null=True, help_text="Default notes on invoices")
    
    # Client portal
    portal_title = models.CharField(max_length=200, blank=True, null=True)
    portal_description = models.TextField(blank=True, null=True)
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Branding Settings"
        verbose_name_plural = "Branding Settings"
    
    def __str__(self):
        return "Branding Settings"


# ============================================
# TAX SETTINGS MODEL
# ============================================

class TaxSettings(models.Model):
    """Global tax configuration"""
    
    TAX_CALCULATION_CHOICES = [
        ('exclusive', 'Tax Exclusive (added to price)'),
        ('inclusive', 'Tax Inclusive (included in price)'),
    ]
    
    # Tax configuration
    tax_calculation = models.CharField(max_length=20, choices=TAX_CALCULATION_CHOICES, default='exclusive')
    default_tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    enable_tax = models.BooleanField(default=True)
    
    # Tax exemption
    enable_tax_exemption = models.BooleanField(default=True)
    tax_exemption_notes = models.TextField(blank=True, null=True)
    
    # VAT/GST numbers
    vat_number = models.CharField(max_length=100, blank=True, null=True, help_text="Your VAT/GST number")
    company_registration = models.CharField(max_length=100, blank=True, null=True)
    
    # Digital goods
    digital_goods_tax_rate = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    eu_vat_rules = models.BooleanField(default=False, help_text="Apply EU VAT rules")
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Tax Settings"
        verbose_name_plural = "Tax Settings"
    
    def __str__(self):
        return "Tax Settings"


# ============================================
# SYSTEM CONFIGURATION MODEL
# ============================================

class SystemConfig(models.Model):
    """System-wide configuration"""
    
    # Maintenance mode
    maintenance_mode = models.BooleanField(default=False)
    maintenance_message = models.TextField(blank=True, null=True)
    maintenance_allowed_ips = models.JSONField(default=list, blank=True, help_text="IPs allowed during maintenance")
    
    # Debug mode
    debug_mode = models.BooleanField(default=False)
    demo_mode = models.BooleanField(default=False)
    
    # Rate limiting
    enable_rate_limiting = models.BooleanField(default=True)
    rate_limit_requests = models.IntegerField(default=100, help_text="Requests per minute")
    rate_limit_burst = models.IntegerField(default=50)
    
    # Session
    session_timeout_minutes = models.IntegerField(default=1440, help_text="Session timeout in minutes")
    max_login_attempts = models.IntegerField(default=5)
    lockout_minutes = models.IntegerField(default=30)
    
    # API
    enable_api = models.BooleanField(default=True)
    enable_api_docs = models.BooleanField(default=True)
    api_rate_limit = models.IntegerField(default=1000, help_text="API requests per hour")
    
    # Cache
    enable_cache = models.BooleanField(default=True)
    cache_timeout_seconds = models.IntegerField(default=300)
    
    # Background tasks
    enable_async_tasks = models.BooleanField(default=True)
    task_worker_count = models.IntegerField(default=2)
    task_retry_delay = models.IntegerField(default=60, help_text="Seconds between retries")
    
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "System Configuration"
        verbose_name_plural = "System Configuration"
    
    def __str__(self):
        return "System Configuration"


# SET-04: immutable revision receipts and durable delivery intent.
# Provider execution is independent and unavailable until sender certification.
class EmailTemplateRevision(models.Model):
    template = models.ForeignKey("settings_registry.EmailTemplate", on_delete=models.PROTECT, related_name="revisions")
    revision = models.PositiveIntegerField()
    actor = models.ForeignKey("accounts.CustomUser", on_delete=models.SET_NULL, null=True, blank=True)
    snapshot = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["template", "revision"], name="email_template_revision_uniq")]

class ConsoleMailOutbox(models.Model):
    idempotency_key = models.CharField(max_length=128, unique=True)
    template = models.ForeignKey("settings_registry.EmailTemplate", on_delete=models.PROTECT)
    recipient = models.EmailField()
    subject = models.CharField(max_length=255)
    body_text = models.TextField()
    body_html = models.TextField()
    audience = models.CharField(max_length=16, choices=[("transactional", "Transactional"),("marketing", "Marketing")])
    status = models.CharField(max_length=24, default="queued", choices=[
        ("queued", "Queued"), ("processing", "Processing"),
        ("sent", "Sent"), ("needs_review", "Needs delivery reconciliation"),
        ("failed", "Failed"), ("suppressed", "Suppressed"),
    ])
    attempts = models.PositiveIntegerField(default=0)
    provider = models.CharField(max_length=80, blank=True, default="")
    provider_receipt = models.CharField(max_length=255, blank=True, default="")
    last_error_code = models.CharField(max_length=80, blank=True, default="")
    next_attempt_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        indexes = [models.Index(fields=["status","created_at"], name="console_mail_state_ix")]

class ConsoleMailAttempt(models.Model):
    outbox = models.ForeignKey("settings_registry.ConsoleMailOutbox",on_delete=models.PROTECT,related_name="delivery_attempts")
    provider = models.CharField(max_length=80)
    outcome = models.CharField(max_length=24,choices=[("accepted","Accepted"),("refused","Refused"),("unknown","Unknown")])
    receipt = models.CharField(max_length=255,blank=True,default="")
    created_at = models.DateTimeField(auto_now_add=True)
