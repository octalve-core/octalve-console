# audit/signals.py

from django.db import OperationalError, ProgrammingError, connection
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from .models import AuditLog


SKIPPED_MODELS = {
    "AuditLog",
    "APIAccessLog",
    "LoginAttempt",
    "Migration",
    # Separate vault lifecycle audit: never copy ciphertext or UUID into generic JSON logs.
    "IntegrationConnection",
    "IntegrationCredentialVersion",
    "IntegrationConnectionEvent",
}


SKIPPED_APPS = {
    "migrations",
    "contenttypes",
    "sessions",
    "admin",
}


def audit_table_exists():
    """
    Prevent audit logging before the AuditLog table has been created.
    This is important during fresh migrations.
    """
    try:
        return AuditLog._meta.db_table in connection.introspection.table_names()
    except (OperationalError, ProgrammingError):
        return False


def should_skip_audit(sender, instance=None, raw=False):
    """
    Decide whether this model action should be ignored by the audit logger.
    """
    if raw:
        return True

    if sender.__name__ in SKIPPED_MODELS:
        return True

    app_label = getattr(sender._meta, "app_label", "")

    if app_label in SKIPPED_APPS:
        return True

    if not audit_table_exists():
        return True

    if instance is not None and not getattr(instance, "pk", None):
        return True

    return False


@receiver(post_save)
def log_model_save(sender, instance, created, raw=False, **kwargs):
    """
    Log model create and update actions.
    """
    if should_skip_audit(sender, instance=instance, raw=raw):
        return

    action = "created" if created else "updated"

    try:
        AuditLog.objects.create(
            actor=getattr(instance, "actor", None),
            action=f"{sender.__name__.lower()}_{action}",
            entity_type=sender.__name__,
            entity_id=str(instance.pk),
            entity_name=str(instance)[:500],
            new_value={"id": instance.pk} if created else None,
            details={"model": sender.__name__},
        )
    except (OperationalError, ProgrammingError):
        return


@receiver(pre_delete)
def log_model_delete(sender, instance, **kwargs):
    """
    Log model delete actions.
    """
    if should_skip_audit(sender, instance=instance):
        return

    try:
        AuditLog.objects.create(
            actor=getattr(instance, "actor", None),
            action=f"{sender.__name__.lower()}_deleted",
            entity_type=sender.__name__,
            entity_id=str(instance.pk),
            entity_name=str(instance)[:500],
            old_value={"id": instance.pk},
            details={"model": sender.__name__},
        )
    except (OperationalError, ProgrammingError):
        return