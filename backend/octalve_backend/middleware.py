# backend/octalve_backend/middleware.py

import logging
import time

logger = logging.getLogger('django.request')

class SimpleRequestLoggingMiddleware:
    """Simple middleware to log all requests and non-200 responses"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        start_time = time.time()
        
        # Get request details
        method = request.method
        path = request.get_full_path()
        
        # Process request
        response = self.get_response(request)
        
        # Calculate duration
        duration = (time.time() - start_time) * 1000
        
        # Log ALL requests
        logger.info(f'{method} {path} - Status: {response.status_code} - {duration:.2f}ms')
        
        # Special log for non-200 responses
        if response.status_code != 200:
            logger.warning(f'NON-200 RESPONSE: {method} {path} - Status: {response.status_code}')
            
            # Log 404s with extra detail
            if response.status_code == 404:
                logger.error(f'404 NOT FOUND: {method} {path}')
            
            # Log 500s with extra detail
            if response.status_code >= 500:
                logger.critical(f'500 SERVER ERROR: {method} {path}')
        
        # Log slow requests (> 2 seconds)
        if duration > 2000:
            logger.warning(f'SLOW REQUEST: {method} {path} - {duration:.2f}ms')
        
        return response

