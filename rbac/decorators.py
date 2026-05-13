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
        def wrapped_view(view_instance, request, *args, **kwargs):
            # Check if the first argument is self (view instance) or request
            # DRF viewsets pass self as first argument
            if hasattr(view_instance, 'get_view_name'):  # It's a viewset instance
                user = request.user if hasattr(request, 'user') else None
            else:
                # It's a regular function view
                user = view_instance.user if hasattr(view_instance, 'user') else None
                request = view_instance
            
            if not user or not has_permission(user, permission_key):
                return JsonResponse(
                    {'error': f'Permission denied: {permission_key} required'},
                    status=403
                )
            return view_func(view_instance, request, *args, **kwargs)
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
        def wrapped_view(view_instance, request, *args, **kwargs):
            if hasattr(view_instance, 'get_view_name'):
                user = request.user if hasattr(request, 'user') else None
            else:
                user = view_instance.user if hasattr(view_instance, 'user') else None
                request = view_instance
            
            if not user or not has_any_permission(user, permission_keys):
                return JsonResponse(
                    {'error': f'Permission denied. Need one of: {", ".join(permission_keys)}'},
                    status=403
                )
            return view_func(view_instance, request, *args, **kwargs)
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
        def wrapped_view(view_instance, request, *args, **kwargs):
            if hasattr(view_instance, 'get_view_name'):
                user = request.user if hasattr(request, 'user') else None
            else:
                user = view_instance.user if hasattr(view_instance, 'user') else None
                request = view_instance
            
            if not user or not has_all_permissions(user, permission_keys):
                return JsonResponse(
                    {'error': f'Permission denied. Need all of: {", ".join(permission_keys)}'},
                    status=403
                )
            return view_func(view_instance, request, *args, **kwargs)
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
        def wrapped_view(view_instance, request, *args, **kwargs):
            if hasattr(view_instance, 'get_view_name'):
                user = request.user if hasattr(request, 'user') else None
            else:
                user = view_instance.user if hasattr(view_instance, 'user') else None
                request = view_instance
            
            if not user or not user.is_authenticated:
                return JsonResponse({'error': 'Authentication required'}, status=401)
            
            if user.role != role_key and not user.is_superuser:
                return JsonResponse(
                    {'error': f'Role {role_key} required'},
                    status=403
                )
            return view_func(view_instance, request, *args, **kwargs)
        return wrapped_view
    return decorator
