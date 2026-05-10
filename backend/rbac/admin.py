# rbac/admin.py

from django.contrib import admin
from .models import Role, Permission, RolePermission, UserRole

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'key', 'is_system', 'is_active', 'created_at']
    list_filter = ['is_system', 'is_active']
    search_fields = ['name', 'key']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ['name', 'key', 'module', 'action', 'is_active']
    list_filter = ['module', 'action', 'is_active']
    search_fields = ['name', 'key', 'description']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ['role', 'permission', 'granted_at']
    list_filter = ['role', 'permission']
    search_fields = ['role__name', 'permission__name']

@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'assigned_at']
    list_filter = ['role']
    search_fields = ['user__email', 'user__full_name', 'role__name']
    raw_id_fields = ['user', 'assigned_by']
