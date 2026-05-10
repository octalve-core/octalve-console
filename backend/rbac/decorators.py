# rbac/decorators.py

from functools import wraps
from django.http import JsonResponse
from .utils import has_permission, has_any_permission, has_all_permissions

def permission_required(permission_key):
    """
    Decorator to require a specific permission.
    
    Usage:
        @permission_required('view_customers')
        def my_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            if not has_permission(request.user, permission_key):
                return JsonResponse(
                    {'error': f'Permission denied: {permission_key} required'},
                    status=403
                )
            return view_func(request, *args, **kwargs)
        return wrapped_view
    return decorator


def any_permission_required(permission_keys):
    """
    Decorator to require any of the given permissions.
    
    Usage:
        @any_permission_required(['view_customers', 'view_orders'])
        def my_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            if not has_any_permission(request.user, permission_keys):
                return JsonResponse(
                    {'error': f'Permission denied. Need one of: {", ".join(permission_keys)}'},
                    status=403
                )
            return view_func(request, *args, **kwargs)
        return wrapped_view
    return decorator


def all_permissions_required(permission_keys):
    """
    Decorator to require all of the given permissions.
    
    Usage:
        @all_permissions_required(['view_customers', 'edit_customers'])
        def my_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            if not has_all_permissions(request.user, permission_keys):
                return JsonResponse(
                    {'error': f'Permission denied. Need all of: {", ".join(permission_keys)}'},
                    status=403
                )
            return view_func(request, *args, **kwargs)
        return wrapped_view
    return decorator


def role_required(role_key):
    """
    Decorator to require a specific role.
    
    Usage:
        @role_required('admin')
        def my_view(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({'error': 'Authentication required'}, status=401)
            
            if request.user.role != role_key and not request.user.is_superuser:
                return JsonResponse(
                    {'error': f'Role {role_key} required'},
                    status=403
                )
            return view_func(request, *args, **kwargs)
        return wrapped_view
    return decorator