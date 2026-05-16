# accounts/admin.py

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    CustomUser,
    ClientProfile,
    StaffProfile,
    LoginHistory,
)


# ============================================
# INLINE MODELS
# ============================================

class ClientProfileInline(admin.StackedInline):
    model = ClientProfile
    extra = 0
    can_delete = False


class StaffProfileInline(admin.StackedInline):
    model = StaffProfile
    extra = 0
    can_delete = False


# ============================================
# CUSTOM USER ADMIN
# ============================================

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    model = CustomUser

    list_display = (
        'email',
        'username',
        'full_name',
        'role',
        'is_staff',
        'is_active',
        'email_verified_at',
        'date_joined',
    )

    list_filter = (
        'role',
        'is_staff',
        'is_superuser',
        'is_active',
        'two_factor_enabled',
        'tax_exempt',
        'date_joined',
    )

    search_fields = (
        'email',
        'username',
        'full_name',
        'phone_number',
        'company_name',
        'referral_code',
    )

    ordering = ('-date_joined',)

    readonly_fields = (
        'referral_code',
        'date_joined',
        'last_login',
        'updated_at',
        'email_verified_at',
        'phone_verified_at',
    )

    fieldsets = (
        ("Authentication", {
            'fields': (
                'email',
                'username',
                'password',
            )
        }),

        ("Personal Info", {
            'fields': (
                'full_name',
                'phone_number',
                'avatar',
            )
        }),

        ("Roles & Permissions", {
            'fields': (
                'role',
                'is_active',
                'is_staff',
                'is_superuser',
                'groups',
                'user_permissions',
            )
        }),

        ("Company & Address", {
            'fields': (
                'company_name',
                'address',
                'city',
                'state',
                'country',
                'postal_code',
            )
        }),

        ("Billing & Tax", {
            'fields': (
                'tax_id',
                'tax_exempt',
                'currency_preference',
            )
        }),

        ("Verification & Security", {
            'fields': (
                'email_verified_at',
                'phone_verified_at',
                'two_factor_enabled',
                'login_failed_attempts',
                'locked_until',
            )
        }),

        ("Preferences", {
            'fields': (
                'language',
                'timezone',
            )
        }),

        ("System Info", {
            'fields': (
                'referral_code',
                'metadata',
                'last_login',
                'date_joined',
                'updated_at',
            )
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'email',
                'username',
                'full_name',
                'password1',
                'password2',
                'role',
                'is_staff',
                'is_active',
            ),
        }),
    )

    inlines = [ClientProfileInline, StaffProfileInline]


# ============================================
# CLIENT PROFILE ADMIN
# ============================================

@admin.register(ClientProfile)
class ClientProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'billing_email',
        'billing_phone',
        'created_at',
    )

    search_fields = (
        'user__email',
        'billing_email',
        'billing_phone',
    )

    readonly_fields = (
        'created_at',
        'updated_at',
    )


# ============================================
# STAFF PROFILE ADMIN
# ============================================

@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'department',
        'job_title',
        'can_handle_tickets',
        'can_handle_provisioning',
    )

    list_filter = (
        'can_handle_tickets',
        'can_handle_provisioning',
        'department',
    )

    search_fields = (
        'user__email',
        'department',
        'job_title',
    )

    readonly_fields = (
        'created_at',
        'updated_at',
    )


# ============================================
# LOGIN HISTORY ADMIN
# ============================================

@admin.register(LoginHistory)
class LoginHistoryAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'ip_address',
        'was_successful',
        'login_time',
    )

    list_filter = (
        'was_successful',
        'login_time',
    )

    search_fields = (
        'user__email',
        'ip_address',
        'failure_reason',
    )

    readonly_fields = (
        'user',
        'ip_address',
        'user_agent',
        'was_successful',
        'failure_reason',
        'login_time',
    )

    ordering = ('-login_time',)
