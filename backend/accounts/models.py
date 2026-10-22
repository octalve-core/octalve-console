import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser, UserManager
from django.utils.translation import gettext_lazy as _
from django.utils import timezone

# ============================================
# CUSTOM USER MANAGER
# ============================================

class CustomUserManager(UserManager):
    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        # Set default role for regular users
        extra_fields.setdefault("role", CustomUser.Role.CLIENT)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        # Force role to ADMIN for superusers
        extra_fields["role"] = CustomUser.Role.ADMIN
        
        # Validate that the user is staff and superuser
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
            
        return self._create_user(email, password, **extra_fields)

# ============================================
# CUSTOM USER MODEL
# ============================================

class CustomUser(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        STAFF = 'staff', 'Staff'
        CLIENT = 'client', 'Client'
    
    # Required fields
    full_name = models.CharField(_("full name"), max_length=255, blank=True)
    email = models.EmailField(_("email address"), unique=True)
    username = models.CharField(max_length=30, unique=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    referral_code = models.CharField(max_length=50, unique=True, editable=False)
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.CLIENT,
        help_text="User role in the system"
    )
    
    # Extra fields for billing and profile
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    company_name = models.CharField(max_length=255, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    
    # Tax info
    tax_id = models.CharField(max_length=100, blank=True, null=True, help_text="VAT/Tax ID")
    tax_exempt = models.BooleanField(default=False, help_text="Tax-exempt customer")
    
    # Verification
    email_verified_at = models.DateTimeField(blank=True, null=True)
    phone_verified_at = models.DateTimeField(blank=True, null=True)
    two_factor_enabled = models.BooleanField(default=False)
    
    # Security
    login_failed_attempts = models.IntegerField(default=0)
    locked_until = models.DateTimeField(blank=True, null=True)
    
    # Preferences
    language = models.CharField(max_length=10, default='en')
    timezone = models.CharField(max_length=50, default='UTC')
    currency_preference = models.CharField(max_length=3, default='NGN')
    
    # Metadata and timestamps
    metadata = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
            models.Index(fields=['referral_code']),
            models.Index(fields=['-date_joined']),
        ]

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        if not self.referral_code:
            self.referral_code = str(uuid.uuid4()).replace("-", "")[:10].upper()
        super().save(*args, **kwargs)

    @property
    def is_locked(self):
        if self.locked_until and self.locked_until > timezone.now():
            return True
        return False


# ============================================
# CLIENT PROFILE (Extra client info)
# ============================================

class ClientProfile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='client_profile')
    billing_email = models.EmailField()
    billing_phone = models.CharField(max_length=20, blank=True, null=True)
    notes = models.TextField(blank=True, null=True, help_text="Internal notes for staff")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile for {self.user.email}"


# ============================================
# STAFF PROFILE (Extra staff info)
# ============================================

class StaffProfile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='staff_profile')
    department = models.CharField(max_length=100, blank=True, null=True)
    job_title = models.CharField(max_length=100, blank=True, null=True)
    can_handle_tickets = models.BooleanField(default=True)
    can_handle_provisioning = models.BooleanField(default=False)
    signature = models.TextField(blank=True, null=True, help_text="Email signature")
    notes = models.TextField(blank=True, null=True, help_text="Internal notes")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Staff profile for {self.user.email}"


# ============================================
# LOGIN HISTORY (Track user logins)
# ============================================

class LoginHistory(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='login_history')
    login_time = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True, null=True)
    was_successful = models.BooleanField(default=True)
    failure_reason = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        ordering = ['-login_time']
        verbose_name_plural = "Login histories"

    def __str__(self):
        return f"{self.user.email} - {self.login_time}"
