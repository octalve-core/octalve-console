"""B1: isolated, inert supplier connections. Never couple these to Provider provisioning."""
import uuid
from django.conf import settings
from django.db import models

class IntegrationConnection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    adapter_key = models.CharField(max_length=40)
    label = models.CharField(max_length=120)
    environment = models.CharField(max_length=8, choices=[("test", "Test"), ("live", "Live")])
    public_settings = models.JSONField(default=dict)
    state = models.CharField(max_length=12, choices=[("draft", "Draft"), ("revoked", "Revoked")], default="draft")
    current_version = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL,
                                  related_name="integration_connections_created")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["adapter_key", "state"])]

class IntegrationCredentialVersion(models.Model):
    connection = models.ForeignKey(IntegrationConnection, on_delete=models.PROTECT, related_name="credential_versions")
    version = models.PositiveIntegerField()
    ciphertext = models.TextField()  # Authenticated encryption, never in API or Admin
    key_id = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["connection", "version"], name="uniq_integration_credential_version")]

class IntegrationConnectionEvent(models.Model):
    connection = models.ForeignKey(IntegrationConnection, on_delete=models.PROTECT, related_name="security_events")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=32)
    version = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["connection", "-created_at"])]
