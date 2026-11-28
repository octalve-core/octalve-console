"""Read-only super-admin review of payment exception evidence."""
from django.db.models import Q
from rest_framework.decorators import api_view,permission_classes
from rest_framework.response import Response
from catalog.permissions import InternalSupplierAuthority
from providers.connection_stepup import assert_admin
from .models import WebhookEvent
from .financial_exceptions import EVENTS

@api_view(["GET"])
@permission_classes([InternalSupplierAuthority])
def financial_exception_review(request):
    assert_admin(request.user)
    rows=list(WebhookEvent.objects.filter(gateway__code="paystack",is_verified=True,
        payload__mode="live").filter(Q(event_type__in=EVENTS)|Q(event_type="charge.success",is_processed=False,error_message__startswith="live_reconciliation_review:")).order_by("-pk")[:101])
    return Response({"cases":[{"id":row.pk,"event":row.event_type,
        "state":"verified_review" if row.is_processed or row.payload.get("late_payment_review") else "awaiting_readback",
        "case":row.payload.get("verified_case"),"created_at":row.created_at.isoformat()} for row in rows[:100]],
        "truncated":len(rows)>100,"refund_execution_enabled":False,"dispute_resolution_enabled":False},
        headers={"Cache-Control":"private, no-store"})
