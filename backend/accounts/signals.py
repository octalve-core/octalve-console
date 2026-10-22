# accounts/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

CustomUser = get_user_model()


@receiver(post_save, sender=CustomUser)
def sync_superuser_role(sender, instance, created, **kwargs):
    """
    Keep `role` in sync with is_staff / is_superuser flags for superusers.
    Uses .update() to avoid triggering post_save recursively.
    """
    if created and instance.is_superuser and instance.role != CustomUser.Role.ADMIN:
        CustomUser.objects.filter(pk=instance.pk).update(role=CustomUser.Role.ADMIN)
        instance.role = CustomUser.Role.ADMIN  # keep in-memory object consistent
