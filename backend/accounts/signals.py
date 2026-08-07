# In accounts models.py or a separate signals.py file

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

CustomUser = get_user_model()

@receiver(post_save, sender=CustomUser)
def set_superuser_role(sender, instance, created, **kwargs):
    """Set role to ADMIN for superusers"""
    if created and instance.is_superuser:
        instance.role = CustomUser.Role.ADMIN
        instance.save(update_fields=['role'])