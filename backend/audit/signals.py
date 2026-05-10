# audit/signals.py

from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from django.conf import settings
from .models import AuditLog

@receiver(post_save)
def log_model_save(sender, instance, created, **kwargs):
    """Log all model saves"""
    if sender.__name__ in ['AuditLog', 'APIAccessLog', 'LoginAttempt']:
        return
    
    action = 'created' if created else 'updated'
    
    AuditLog.objects.create(
        actor=getattr(instance, 'actor', None),
        action=f"{sender.__name__.lower()}_{action}",
        entity_type=sender.__name__,
        entity_id=str(instance.id),
        entity_name=str(instance)[:500],
        new_value={'id': instance.id} if created else None,
        details={'model': sender.__name__}
    )


@receiver(pre_delete)
def log_model_delete(sender, instance, **kwargs):
    """Log all model deletions"""
    if sender.__name__ in ['AuditLog', 'APIAccessLog', 'LoginAttempt']:
        return
    
    AuditLog.objects.create(
        action=f"{sender.__name__.lower()}_deleted",
        entity_type=sender.__name__,
        entity_id=str(instance.id),
        entity_name=str(instance)[:500],
        old_value={'id': instance.id}
    )