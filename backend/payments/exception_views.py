"""Read-only super-admin review of payment exception evidence."""
from django.db.models import Q
from rest_framework.decorators import api_view,permission_classes,throttle_classes
from rest_framework.exceptions import ValidationError
from providers.connection_views import VaultMutationThrottle
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
    from .live_reconciliation import enabled
    from .models import PaymentGateway,Transaction
    from .live_binding import resolve_live_key
    gateway=PaymentGateway.objects.filter(code="paystack",test_mode=False,status="active").first()
    pending=Transaction.objects.filter(transaction_type="payment",gateway=gateway,
        metadata__paystack_refund_request_v1__state__in=("uncertain","submitted","processed","failed")).order_by("-updated_at")[:100] if gateway else []
    return Response({"requests":[{"payment":str(x.public_id),"reference":x.metadata["paystack_refund_request_v1"]["reference"],
        "amount_minor":x.metadata["paystack_refund_request_v1"]["amount_minor"],"state":x.metadata["paystack_refund_request_v1"]["state"]} for x in pending],"cases":[{"id":row.pk,"event":row.event_type,
        "state":"verified_review" if row.is_processed or row.payload.get("late_payment_review") else "awaiting_readback",
        "case":row.payload.get("verified_case"),"created_at":row.created_at.isoformat()} for row in rows[:100]],
        "truncated":len(rows)>100,"refund_execution_enabled":bool(enabled() and gateway and resolve_live_key(gateway)),"dispute_resolution_enabled":False},
        headers={"Cache-Control":"private, no-store"})


@api_view(["POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def refund_request(request):
    from .refund_authority import request_refund,ExceptionRefused
    assert_admin(request.user)
    data=request.data
    if not isinstance(data,dict) or set(data)!={"transaction_public_id","amount_minor","confirm_password","totp_code","confirm_refund"} or data["confirm_refund"] is not True:
        raise ValidationError("Explicit refund authorization is required.")
    try:
        result=request_refund(request.user,data["transaction_public_id"],data["amount_minor"],data["confirm_password"],data["totp_code"])
    except ExceptionRefused as exc:
        raise ValidationError(str(exc)) from None
    return Response(result,status=202,headers={"Cache-Control":"private, no-store"})
