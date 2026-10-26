"""Console-owned, server-only proof of provisioning and single-use launch grants."""
import uuid
from django.conf import settings
from django.db import models


class VerifiedHostingBinding(models.Model):
    """Created ONLY by a future vetted provider read-back worker, never by a public API."""
    service = models.OneToOneField("services.Service", on_delete=models.CASCADE, related_name="opanel_binding")
    provider_id_snapshot = models.IntegerField()
    account_digest = models.CharField(max_length=64)
    binding_ref = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    confirmation_source = models.CharField(max_length=40)
    confirmed_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "OPanel verified hosting binding"


class OPanelLaunchGrant(models.Model):
    """Only SHA-256 of the opaque one-time authorization code is stored."""
    code_digest = models.CharField(max_length=64, unique=True)
    service = models.ForeignKey("services.Service", on_delete=models.CASCADE)
    subject = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    binding = models.ForeignKey(VerifiedHostingBinding, on_delete=models.CASCADE)
    code_challenge = models.CharField(max_length=128)
    redirect_uri = models.URLField(max_length=500)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["expires_at"], name="opanel_grant_expires_idx")]
