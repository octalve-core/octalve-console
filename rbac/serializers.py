# rbac/serializers.py (create if missing)

from rest_framework import serializers
from .models import Role, Permission, UserRole, RolePermission


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'key', 'description', 'is_system', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']  # ✅ Use list


class PermissionSerializer(serializers.ModelSerializer):
    module_display = serializers.CharField(source='get_module_display', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = Permission
        fields = ['id', 'key', 'name', 'module', 'module_display', 'action', 
                  'action_display', 'description', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']  # ✅ Use list


class UserRoleSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    
    class Meta:
        model = UserRole
        fields = ['id', 'user', 'user_email', 'role', 'role_name', 'assigned_at']
        read_only_fields = ['id', 'assigned_at']  # ✅ Use list

