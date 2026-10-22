# rbac/middleware.py

from django.shortcuts import redirect
from django.urls import resolve
from django.conf import settings
from .utils import has_permission

class RBACMiddleware:
    """
    Middleware to check permissions for each request.
    """
    
    # Public URLs that don't require authentication
    PUBLIC_URLS = [
        '/api/auth/',
        '/api/auth/register/',
        '/api/auth/login/',
        '/api/auth/jwt/',
        '/api/auth/password/',
        '/api/docs/',
        '/api/schema/',
        '/admin/',
    ]
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Skip permission check for public URLs
        path = request.path
        for public_url in self.PUBLIC_URLS:
            if path.startswith(public_url):
                return self.get_response(request)
        
        # Skip if user is not authenticated
        if not request.user.is_authenticated:
            return self.get_response(request)
        
        # Skip for superusers (they have all permissions)
        if request.user.is_superuser:
            return self.get_response(request)
        
        # Get required permission for this URL
        required_permission = self.get_required_permission(request)
        
        if required_permission:
            if not has_permission(request.user, required_permission):
                from django.http import JsonResponse
                return JsonResponse(
                    {'error': 'You do not have permission to perform this action'},
                    status=403
                )
        
        return self.get_response(request)
    
    def get_required_permission(self, request):
        """
        Map URL paths to required permissions.
        This is a simple mapping - you can expand as needed.
        """
        path = request.path
        method = request.method
        
        # API endpoints mapping
        permissions_map = {
            # Customers
            ('GET', '/api/customers/'): 'view_customers',
            ('POST', '/api/customers/'): 'create_customers',
            ('PUT', '/api/customers/'): 'update_customers',
            ('DELETE', '/api/customers/'): 'delete_customers',
            
            # Invoices
            ('GET', '/api/invoices/'): 'view_invoices',
            ('POST', '/api/invoices/'): 'create_invoices',
            ('POST', '/api/invoices/pay/'): 'manage_invoices',
            
            # Services
            ('GET', '/api/services/services/'): 'view_services',
            ('POST', '/api/services/provision/'): 'provision_services',
            ('POST', '/api/services/suspend/'): 'suspend_services',
            ('POST', '/api/services/terminate/'): 'terminate_services',
            
            # Tickets
            ('GET', '/api/tickets/'): 'view_tickets',
            ('POST', '/api/tickets/'): 'create_tickets',
            ('POST', '/api/tickets/reply/'): 'reply_tickets',
            
            # Settings
            ('GET', '/api/settings/'): 'view_settings',
            ('PUT', '/api/settings/'): 'manage_settings',
            
            # Providers
            ('GET', '/api/providers/'): 'view_providers',
            ('POST', '/api/providers/'): 'manage_providers',
            
            # Audit
            ('GET', '/api/audit/'): 'view_audit_logs',
        }
        
        for (method_pattern, path_pattern), permission in permissions_map.items():
            if method == method_pattern and path.startswith(path_pattern):
                return permission
        
        return None