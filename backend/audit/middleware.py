# audit/middleware.py

import time
from .models import APIAccessLog, AuditLog

class APILoggingMiddleware:
    """Middleware to log all API requests"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Skip logging for non-API paths
        if not request.path.startswith('/api/'):
            return self.get_response(request)
        
        start_time = time.time()
        
        # Process request
        response = self.get_response(request)
        
        # Calculate response time
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Log API access
        if request.user and request.user.is_authenticated:
            APIAccessLog.objects.create(
                user=request.user if request.user.is_authenticated else None,
                method=request.method,
                path=request.path,
                query_string=request.META.get('QUERY_STRING', ''),
                status_code=response.status_code,
                response_time_ms=response_time_ms,
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
                request_body_size=len(request.body),
                response_body_size=len(response.content) if hasattr(response, 'content') else 0
            )
        
        return response


class AuditMiddleware:
    """Middleware to log important actions automatically"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        response = self.get_response(request)
        
        # Log specific actions based on response
        if request.path.startswith('/api/auth/login'):
            if response.status_code == 200 and hasattr(request, 'user'):
                AuditLog.objects.create(
                    actor=request.user if request.user.is_authenticated else None,
                    actor_email=request.user.email if request.user.is_authenticated else request.POST.get('email'),
                    actor_ip=request.META.get('REMOTE_ADDR'),
                    action='login',
                    request_method='POST',
                    request_path=request.path,
                    details={'success': True}
                )
        
        return response