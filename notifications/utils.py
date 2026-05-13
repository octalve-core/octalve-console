# notifications/utils.py (create if needed)

from django.core.mail import send_mail
from django.conf import settings

def send_notification(user, template_key, context):
    """Send notification to user via email/in-app"""
    # This is a placeholder - implement based on your notification system
    subject = f"Octalve Support: {context.get('ticket_number', 'Update')}"
    message = f"Hello {user.full_name},\n\n{context.get('message_preview', 'You have a new update')}\n\nThank you,\nOctalve Team"
    
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True
    )