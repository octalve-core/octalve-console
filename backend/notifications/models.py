"""Durable customer notices; separate delivery from payment/provisioning truth."""
from django.db import models


class HostingNotice(models.Model):
    event_key = models.CharField(max_length=120, unique=True)
    service = models.ForeignKey("services.Service", on_delete=models.PROTECT,
                                related_name="hosting_notices")
    destination_email = models.EmailField()
    subject = models.CharField(max_length=250)
    text_body = models.TextField()
    status = models.CharField(max_length=24, default="queued",
                              choices=[("queued", "Queued"), ("sent", "Sent"),
                                       ("failed", "Failed")])
    attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["status", "created_at"],
                                name="hosting_notice_outbox_ix")]
