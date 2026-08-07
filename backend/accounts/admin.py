from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
import datetime
from .models import (
    CustomUser, 
    ClientProfile, 
    StaffProfile, 
    LoginHistory
)


# ============================================
# INLINE ADMIN CLASSES
# ============================================

class ClientProfileInline(admin.StackedInline):
    """Inline for ClientProfile when viewing a user"""
    model = ClientProfile
    can_delete = False
    verbose_name_plural = 'Client Profile'
    fk_name = 'user'
    fieldsets = (
        (None, {
            'fields': (
                'billing_email',
                'billing_phone',
                'notes'
            )
        }),
        (_('Timestamps'), {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    readonly_fields = ('created_at', 'updated_at')


class StaffProfileInline(admin.StackedInline):
    """Inline for StaffProfile when viewing a user"""
    model = StaffProfile
    can_delete = False
    verbose_name_plural = 'Staff Profile'
    fk_name = 'user'
    fieldsets = (
        (None, {
            'fields': (
                'department',
                'job_title',
                'signature'
            )
        }),
        (_('Permissions'), {
            'fields': (
                'can_handle_tickets',
                'can_handle_provisioning'
            )
        }),
        (_('Timestamps'), {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    readonly_fields = ('created_at', 'updated_at')


class LoginHistoryInline(admin.TabularInline):
    """Inline for LoginHistory when viewing a user"""
    model = LoginHistory
    can_delete = False
    verbose_name_plural = 'Login History'
    fk_name = 'user'
    fields = ('login_time', 'ip_address', 'was_successful', 'failure_reason')
    readonly_fields = ('login_time', 'ip_address', 'user_agent', 'was_successful', 'failure_reason')
    max_num = 10  # Show only last 10 login records
    ordering = ('-login_time',)
    
    def has_add_permission(self, request, obj=None):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False


# ============================================
# CUSTOM USER ADMIN
# ============================================

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = (
        'email', 
        'username', 
        'full_name', 
        'role', 
        'is_staff', 
        'is_active',
        'date_joined',
        'is_locked_display'
    )
    
    list_filter = (
        'role', 
        'is_staff', 
        'is_active', 
        'is_superuser',
        'tax_exempt',
        'two_factor_enabled',
        'email_verified_at',
        'date_joined',
        'language'
    )
    
    search_fields = (
        'email', 
        'username', 
        'full_name', 
        'phone_number',
        'company_name',
        'referral_code'
    )
    
    readonly_fields = (
        'referral_code', 
        'date_joined', 
        'last_login',
        'updated_at',
        'login_failed_attempts',
        'locked_until',
        'email_verified_at',
        'phone_verified_at'
    )
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal Info'), {
            'fields': (
                'username',
                'full_name',
                'phone_number',
                'avatar',
                'company_name',
                'address',
                'city',
                'state',
                'country',
                'postal_code'
            )
        }),
        (_('Role & Permissions'), {
            'fields': (
                'role',
                'is_active',
                'is_staff',
                'is_superuser',
                'groups',
                'user_permissions'
            ),
            'classes': ('collapse',),
        }),
        (_('Tax & Billing'), {
            'fields': (
                'tax_id',
                'tax_exempt',
            ),
            'classes': ('collapse',),
        }),
        (_('Verification & Security'), {
            'fields': (
                'email_verified_at',
                'phone_verified_at',
                'two_factor_enabled',
                'login_failed_attempts',
                'locked_until',
            ),
            'classes': ('collapse',),
        }),
        (_('Preferences'), {
            'fields': (
                'language',
                'timezone',
                'currency_preference',
            ),
            'classes': ('collapse',),
        }),
        (_('Important Dates'), {
            'fields': (
                'last_login',
                'date_joined',
                'updated_at',
            ),
            'classes': ('collapse',),
        }),
        (_('Metadata'), {
            'fields': ('metadata', 'referral_code'),
            'classes': ('collapse',),
        }),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'email', 
                'username', 
                'password1', 
                'password2',
                'full_name',
                'phone_number',
                'role'
            ),
        }),
    )
    
    ordering = ('-date_joined',)
    list_per_page = 50
    
    # Add inlines to show related profiles
    inlines = [ClientProfileInline, StaffProfileInline, LoginHistoryInline]
    
    # Custom list display method
    def is_locked_display(self, obj):
        return obj.is_locked
    is_locked_display.short_description = "Is Locked"
    is_locked_display.boolean = True
    
    # Custom actions
    actions = [
        'mark_as_staff',
        'mark_as_client',
        'mark_as_admin',
        'enable_two_factor',
        'disable_two_factor',
        'lock_accounts',
        'unlock_accounts',
        'verify_email',
        'unverify_email',
        'verify_phone',
        'unverify_phone',
        'reset_login_attempts',
    ]
    
    def mark_as_staff(self, request, queryset):
        updated = queryset.update(role=CustomUser.Role.STAFF)
        self.message_user(request, f"{updated} users marked as staff.")
    mark_as_staff.short_description = "Set role to Staff"
    
    def mark_as_client(self, request, queryset):
        updated = queryset.update(role=CustomUser.Role.CLIENT)
        self.message_user(request, f"{updated} users marked as clients.")
    mark_as_client.short_description = "Set role to Client"
    
    def mark_as_admin(self, request, queryset):
        updated = queryset.update(role=CustomUser.Role.ADMIN)
        self.message_user(request, f"{updated} users marked as admins.")
    mark_as_admin.short_description = "Set role to Admin"
    
    def enable_two_factor(self, request, queryset):
        updated = queryset.update(two_factor_enabled=True)
        self.message_user(request, f"Two-factor enabled for {updated} users.")
    enable_two_factor.short_description = "Enable 2FA"
    
    def disable_two_factor(self, request, queryset):
        updated = queryset.update(two_factor_enabled=False)
        self.message_user(request, f"Two-factor disabled for {updated} users.")
    disable_two_factor.short_description = "Disable 2FA"
    
    def lock_accounts(self, request, queryset):
        lock_time = timezone.now() + datetime.timedelta(hours=24)
        updated = queryset.update(locked_until=lock_time)
        self.message_user(request, f"{updated} accounts locked for 24 hours.")
    lock_accounts.short_description = "Lock accounts for 24 hours"
    
    def unlock_accounts(self, request, queryset):
        updated = queryset.update(locked_until=None)
        self.message_user(request, f"{updated} accounts unlocked.")
    unlock_accounts.short_description = "Unlock accounts"
    
    def verify_email(self, request, queryset):
        updated = queryset.update(email_verified_at=timezone.now())
        self.message_user(request, f"{updated} emails verified.")
    verify_email.short_description = "Verify email"
    
    def unverify_email(self, request, queryset):
        updated = queryset.update(email_verified_at=None)
        self.message_user(request, f"{updated} emails unverified.")
    unverify_email.short_description = "Unverify email"
    
    def verify_phone(self, request, queryset):
        updated = queryset.update(phone_verified_at=timezone.now())
        self.message_user(request, f"{updated} phones verified.")
    verify_phone.short_description = "Verify phone"
    
    def unverify_phone(self, request, queryset):
        updated = queryset.update(phone_verified_at=None)
        self.message_user(request, f"{updated} phones unverified.")
    unverify_phone.short_description = "Unverify phone"
    
    def reset_login_attempts(self, request, queryset):
        updated = queryset.update(login_failed_attempts=0)
        self.message_user(request, f"Login attempts reset for {updated} users.")
    reset_login_attempts.short_description = "Reset failed login attempts"


# ============================================
# CLIENT PROFILE ADMIN
# ============================================

@admin.register(ClientProfile)
class ClientProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'user_email',
        'billing_email',
        'billing_phone',
        'created_at'
    )
    list_filter = ('created_at', 'updated_at')
    search_fields = (
        'user__email',
        'user__username',
        'billing_email',
        'billing_phone',
        'notes'
    )
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        (None, {
            'fields': (
                'user',
                'billing_email',
                'billing_phone'
            )
        }),
        (_('Notes'), {
            'fields': ('notes',)
        }),
        (_('Timestamps'), {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    raw_id_fields = ('user',)
    autocomplete_fields = ('user',)
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = "User Email"
    user_email.admin_order_field = 'user__email'
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  # editing an existing object
            return self.readonly_fields + ('user',)
        return self.readonly_fields


# ============================================
# STAFF PROFILE ADMIN
# ============================================

@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'user_email',
        'department',
        'job_title',
        'can_handle_tickets',
        'can_handle_provisioning'
    )
    list_filter = (
        'can_handle_tickets',
        'can_handle_provisioning',
        'department',
        'created_at'
    )
    search_fields = (
        'user__email',
        'user__username',
        'department',
        'job_title'
    )
    readonly_fields = ('created_at', 'updated_at')
    
    fieldsets = (
        (None, {
            'fields': ('user',)
        }),
        (_('Employment Details'), {
            'fields': (
                'department',
                'job_title',
                'signature'
            )
        }),
        (_('Permissions'), {
            'fields': (
                'can_handle_tickets',
                'can_handle_provisioning'
            )
        }),
        (_('Timestamps'), {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    
    raw_id_fields = ('user',)
    autocomplete_fields = ('user',)
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = "User Email"
    user_email.admin_order_field = 'user__email'
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  # editing an existing object
            return self.readonly_fields + ('user',)
        return self.readonly_fields


# ============================================
# LOGIN HISTORY ADMIN
# ============================================

@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'user_email',
        'login_time',
        'ip_address',
        'was_successful',
        'failure_reason'
    )
    list_filter = (
        'was_successful',
        'login_time',
    )
    search_fields = (
        'user__email',
        'user__username',
        'ip_address',
        'failure_reason'
    )
    readonly_fields = (
        'user',
        'login_time',
        'ip_address',
        'user_agent',
        'was_successful',
        'failure_reason'
    )
    
    fieldsets = (
        (None, {
            'fields': (
                'user',
                'login_time',
                'ip_address',
                'user_agent'
            )
        }),
        (_('Status'), {
            'fields': (
                'was_successful',
                'failure_reason'
            )
        }),
    )
    
    ordering = ('-login_time',)
    list_per_page = 100
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = "User Email"
    user_email.admin_order_field = 'user__email'
    
    def has_add_permission(self, request):
        # Prevent manual creation of login history entries
        return False
    
    def has_change_permission(self, request, obj=None):
        # Prevent editing existing login history entries
        return False
    
    def has_delete_permission(self, request, obj=None):
        # Allow deletion (e.g., for data cleanup)
        return True


# ============================================
# REGISTER MODELS WITH CUSTOM ADMIN SITES
# ============================================

# Customize admin site headers
admin.site.site_header = "My Project Administration"
admin.site.site_title = "My Project Admin"
admin.site.index_title = "Welcome to My Project Admin Panel"