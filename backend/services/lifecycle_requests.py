"""Review-only service cancellation requests; do not touch provider state.

Only an accepted worker may suspend, terminate or otherwise change real
customer hosting authority after verified vendor and billing readback.
"""
from django.db import transaction

from .models import Service, ServiceActionLog


class ServiceRequestRefused(ValueError):
    pass


def request_service_cancellation(service_id, *, actor, reason=""):
    if not isinstance(reason, str) or len(reason) > 500:
        raise ServiceRequestRefused("Invalid cancellation reason.")
    with transaction.atomic():
        service = Service.objects.select_for_update().get(pk=service_id)
        if service.status not in ("active", "suspended"):
            raise ServiceRequestRefused("Only active or suspended services can request cancellation.")
        prior = (ServiceActionLog.objects.filter(
            service=service, action="cancel",
            details__state="pending_review",
        ).order_by("id").first())
        if prior:
            return prior, False
        record = ServiceActionLog.objects.create(
            service=service, action="cancel", performed_by=actor, success=False,
            details={"state": "pending_review", "request_reason": reason.strip()},
        )
        # No Service.status change: maintain existing paid entitlement pending review.
        return record, True
