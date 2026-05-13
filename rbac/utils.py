# rbac/utils.py

from django.core.cache import cache
from .models import UserRole

def get_user_permissions(user):
    """
    Get all permissions for a user (cached for performance).
    """
    if not user.is_authenticated:
        return set()
    
    # Superusers have all permissions
    if user.is_superuser:
        from .models import Permission
        return set(Permission.objects.values_list('key', flat=True))
    
    # Check cache
    cache_key = f'user_permissions_{user.id}'
    permissions = cache.get(cache_key)
    
    if permissions is None:
        # Get permissions from user's roles
        roles = UserRole.objects.filter(user=user).select_related('role')
        permissions = set()
        
        for user_role in roles:
            role_permissions = user_role.role.permissions.all()
            permissions.update(role_permissions.values_list('key', flat=True))
        
        # Cache for 5 minutes
        cache.set(cache_key, permissions, 300)
    
    return permissions


def has_permission(user, permission_key):
    """
    Check if a user has a specific permission.
    """
    if not user.is_authenticated:
        return False
    
    if user.is_superuser:
        return True
    
    permissions = get_user_permissions(user)
    return permission_key in permissions


def has_any_permission(user, permission_keys):
    """
    Check if a user has any of the given permissions.
    """
    if not user.is_authenticated:
        return False
    
    if user.is_superuser:
        return True
    
    permissions = get_user_permissions(user)
    return any(key in permissions for key in permission_keys)


def has_all_permissions(user, permission_keys):
    """
    Check if a user has all of the given permissions.
    """
    if not user.is_authenticated:
        return False
    
    if user.is_superuser:
        return True
    
    permissions = get_user_permissions(user)
    return all(key in permissions for key in permission_keys)


def clear_user_permissions_cache(user):
    """
    Clear cached permissions for a user.
    """
    cache_key = f'user_permissions_{user.id}'
    cache.delete(cache_key)


def assign_role_to_user(user, role_key, assigned_by=None):
    """
    Assign a role to a user.
    """
    from .models import Role, UserRole
    
    try:
        role = Role.objects.get(key=role_key)
        user_role, created = UserRole.objects.get_or_create(
            user=user,
            role=role,
            defaults={'assigned_by': assigned_by}
        )
        
        # Clear cache
        clear_user_permissions_cache(user)
        
        return created
    except Role.DoesNotExist:
        return False


def remove_role_from_user(user, role_key):
    """
    Remove a role from a user.
    """
    from .models import Role, UserRole
    
    try:
        role = Role.objects.get(key=role_key)
        UserRole.objects.filter(user=user, role=role).delete()
        
        # Clear cache
        clear_user_permissions_cache(user)
        
        return True
    except Role.DoesNotExist:
        return False