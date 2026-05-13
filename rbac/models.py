# rbac/models.py

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError

# ============================================
# ROLE MODEL
# ============================================

class Role(models.Model):
    """
    Role model for RBAC.
    
    Default roles:
    - admin: Full system access
    - staff: Limited staff access
    - client: Customer access
    """
    
    # Basic info
    name = models.CharField(max_length=50, unique=True)
    key = models.CharField(max_length=50, unique=True, help_text="System identifier (e.g., 'admin', 'staff', 'client')")
    description = models.TextField(blank=True, null=True)
    
    # Status
    is_system = models.BooleanField(default=False, help_text="System roles cannot be deleted")
    is_active = models.BooleanField(default=True)
    
    # Hierarchy (for inheritance)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['key']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        if not self.key:
            self.key = self.name.lower().replace(' ', '_')
        super().save(*args, **kwargs)
    
    def delete(self, *args, **kwargs):
        if self.is_system:
            raise ValidationError("System roles cannot be deleted")
        super().delete(*args, **kwargs)


# ============================================
# PERMISSION MODEL
# ============================================

class Permission(models.Model):
    """
    Granular permission model.
    
    Format: {module}_{action}
    Example: view_customers, create_invoices, suspend_services
    """
    
    MODULE_CHOICES = [
        ('users', 'Users & Accounts'),
        ('customers', 'Customers'),
        ('products', 'Products & Catalog'),
        ('plans', 'Plans & Pricing'),
        ('orders', 'Orders'),
        ('invoices', 'Invoices'),
        ('transactions', 'Transactions'),
        ('services', 'Services'),
        ('domains', 'Domains'),
        ('dns', 'DNS Records'),
        ('tickets', 'Support Tickets'),
        ('knowledge', 'Knowledge Base'),
        ('wallet', 'Wallet'),
        ('gateways', 'Payment Gateways'),
        ('providers', 'Service Providers'),
        ('provisioning', 'Provisioning Queue'),
        ('settings', 'System Settings'),
        ('audit', 'Audit Logs'),
        ('reports', 'Reports'),
        ('staff', 'Staff Management'),
    ]
    
    ACTION_CHOICES = [
        ('view', 'View'),
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('approve', 'Approve'),
        ('cancel', 'Cancel'),
        ('suspend', 'Suspend'),
        ('unsuspend', 'Unsuspend'),
        ('terminate', 'Terminate'),
        ('provision', 'Provision'),
        ('manage', 'Manage'),
        ('assign', 'Assign'),
    ]
    
    # Basic info
    key = models.CharField(max_length=100, unique=True, help_text="e.g., 'view_customers'")
    name = models.CharField(max_length=100)
    module = models.CharField(max_length=50, choices=MODULE_CHOICES)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    description = models.TextField(blank=True, null=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['module', 'name']
        indexes = [
            models.Index(fields=['key']),
            models.Index(fields=['module']),
            models.Index(fields=['action']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.key})"
    
    def save(self, *args, **kwargs):
        if not self.key:
            self.key = f"{self.module}_{self.action}".lower().replace(' ', '_')
        if not self.name:
            self.name = f"{self.get_action_display()} {self.get_module_display()}"
        super().save(*args, **kwargs)


# ============================================
# ROLE-PERMISSION MAPPING
# ============================================

class RolePermission(models.Model):
    """
    Many-to-many relationship between roles and permissions.
    """
    
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='roles')
    granted_at = models.DateTimeField(auto_now_add=True)
    granted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        unique_together = ['role', 'permission']
        indexes = [
            models.Index(fields=['role', 'permission']),
        ]
    
    def __str__(self):
        return f"{self.role.name} -> {self.permission.name}"


# ============================================
# USER-ROLE MAPPING (Connects to CustomUser)
# ============================================

class UserRole(models.Model):
    """
    Many-to-many relationship between users (CustomUser) and roles.
    This links your accounts.CustomUser to RBAC roles.
    """
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='users')
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_roles')
    
    class Meta:
        unique_together = ['user', 'role']
        indexes = [
            models.Index(fields=['user', 'role']),
        ]
    
    def __str__(self):
        return f"{self.user.email} -> {self.role.name}"
