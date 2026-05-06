from djoser import email
from django.conf import settings
from django.utils.http import urlsafe_base64_encode, urlencode
from django.utils.encoding import force_bytes
from urllib.parse import quote


# class PasswordResetEmail(email.PasswordResetEmail):
#     """
#     Custom password reset email that uses frontend URL instead of backend
#     """
#     template_name = 'email/password_reset.html'
    
#     def get_context_data(self):
#         context = super().get_context_data()
#         # Override the reset URL to use frontend domain
#         uid = context.get('uid')
#         token = context.get('token')
        
#         if uid and token:
#             # Build frontend URL for password reset confirmation
#             # Format: FRONTEND_URL/password-reset/confirm/uid/token
#             frontend_reset_url = f"{settings.FRONTEND_URL}/password-reset/confirm/{uid}/{token}"
#             context['reset_url'] = frontend_reset_url
#             context['frontend_url'] = settings.FRONTEND_URL
        
#         # Add your company/application details
#         context['app_name'] = 'Octalve'
#         context['support_email'] = 'support@octalve.com'
        
#         return context


class CustomPasswordResetEmail(email.PasswordResetEmail):
    """
    Override the password reset email to use frontend URL
    """
    
    def get_context_data(self):
        context = super().get_context_data()
        
        # Manually build the frontend URL
        uid = context.get('uid')
        token = context.get('token')
        
        if uid and token:
            encoded_token = quote(token, safe='')
            
            # Build frontend URL with properly encoded token
            frontend_reset_url = f"{settings.FRONTEND_URL}/reset-password/confirm/{uid}/{encoded_token}"
            context['reset_url'] = frontend_reset_url
            context['frontend_url'] = settings.FRONTEND_URL
            
            # Override domain to frontend
            context['domain'] = settings.FRONTEND_URL.replace('http://', '').replace('https://', '')
            context['site_name'] = 'Octalve'
            
        return context


class PasswordChangedConfirmationEmail(email.PasswordChangedConfirmationEmail):
    template_name = 'email/password_changed.html'
    
    def get_context_data(self):
        context = super().get_context_data()
        context['frontend_url'] = settings.FRONTEND_URL
        context['app_name'] = 'Octalve'
        return context

class UsernameResetEmail(email.UsernameResetEmail):
    template_name = 'email/username_reset.html'
    
    def get_context_data(self):
        context = super().get_context_data()
        uid = context.get('uid')
        token = context.get('token')
        
        if uid and token:
            frontend_reset_url = f"{settings.FRONTEND_URL}/username-reset/confirm/{uid}/{token}"
            context['reset_url'] = frontend_reset_url
        
        context['frontend_url'] = settings.FRONTEND_URL
        context['app_name'] = 'Octalve'
        return context

class UsernameChangedConfirmationEmail(email.UsernameChangedConfirmationEmail):
    template_name = 'email/username_changed.html'
    
    def get_context_data(self):
        context = super().get_context_data()
        context['frontend_url'] = settings.FRONTEND_URL
        context['app_name'] = 'Octalve'
        return context
