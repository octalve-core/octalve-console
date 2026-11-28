"""Bounded live Paystack reconciliation, never a charge or sandbox replay."""
import os
import secrets
from django.conf import settings
from django.db import DatabaseError
from django.db.models import F,Q
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import PaymentIntent,WebhookEvent
from .settlement import settle_verified_intent,SettlementRefused
from .readback import PaymentReadbackRejected
from .domain_pilot_scope import is_pilot_invoice
from .live_binding import resolve_live_key

def enabled():
    return all(getattr(settings,key,False) for key in ("CLOUD_LIVE_PAYSTACK_RECONCILIATION_ENABLED",
        "CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED","CLOUD_GATEWAY_READBACK_ENABLED","CLOUD_SETTLEMENT_COMMIT_ENABLED"))

def consume(event_id):
    if not enabled():
        return "disabled"
    from .financial_exceptions import EVENTS,consume as consume_exception
    if WebhookEvent.objects.filter(pk=event_id,event_type__in=EVENTS).exists():
        return consume_exception(event_id)
    event=WebhookEvent.objects.select_related("gateway").filter(pk=event_id,is_verified=True,
        event_type="charge.success",gateway__code="paystack",gateway__test_mode=False,gateway__status="active").first()
    if not event:
        return "ignored"
    if event.is_processed:
        return "processed"
    payload=event.payload
    if not isinstance(payload,dict) or payload.get("mode")!="live" or type(payload.get("intent_id")) is not int:
        return "held"
    intent=PaymentIntent.objects.select_related("invoice","gateway").filter(pk=payload["intent_id"],reference=payload.get("reference"),gateway=event.gateway).first()
    if (not intent or is_pilot_invoice(intent.invoice) or not resolve_live_key(event.gateway)
            or payload.get("binding")!=event.gateway.config
            or intent.metadata.get("payment_mode")!="live" or intent.metadata.get("gateway_binding")!=event.gateway.config):
        return "held"
    if intent.status!="completed" and (intent.is_expired() or intent.status in ("expired","failed")):
        from .financial_exceptions import verify_late_payment
        return verify_late_payment(event,intent)
    try:
        settle_verified_intent(intent.pk,signed_event_id=event.pk)
        return "processed" if WebhookEvent.objects.filter(pk=event.pk,is_processed=True).exists() else "held"
    except (SettlementRefused,PaymentReadbackRejected,DatabaseError):
        return "held"

def attempt(event_id):
    result=consume(event_id)
    if result=="held":
        WebhookEvent.objects.filter(pk=event_id,is_verified=True,is_processed=False,gateway__test_mode=False).update(
            error_message="live_reconciliation_review:"+timezone.now().isoformat())
    return result

def run_due(limit=5):
    result={"enabled":enabled(),"processed":0,"held":0}
    if not result["enabled"]:
        return result
    from .financial_exceptions import EVENTS
    ids=list(WebhookEvent.objects.filter(is_verified=True,is_processed=False,event_type__in=["charge.success",*EVENTS],
        gateway__code="paystack",gateway__test_mode=False,gateway__status="active",payload__mode="live")
        .filter(Q(payload__late_payment_review__isnull=True)|Q(payload__late_payment_review=False)).order_by(F("error_message").asc(nulls_first=True),"pk").values_list("pk",flat=True)[:min(max(int(limit),1),10)])
    for pk in ids:
        outcome=attempt(pk)
        if outcome in ("processed","held"):
            result[outcome]+=1
    from .refund_authority import KEY,reconcile_request
    from .models import Transaction
    requests_due=Transaction.objects.filter(transaction_type="payment",metadata__paystack_refund_request_v1__state__in=("uncertain","submitted")).order_by("updated_at","pk").values_list("pk",flat=True)[:1]
    for pk in requests_due:
        outcome=reconcile_request(pk)
        result[outcome]+=1
        if outcome=="held":
            Transaction.objects.filter(pk=pk).update(updated_at=timezone.now())
    from .dispute_authority import reconcile as reconcile_dispute
    for pk in Transaction.objects.filter(transaction_type="payment",metadata__paystack_dispute_request_v1__state="uncertain").order_by("updated_at","pk").values_list("pk",flat=True)[:1]:
        outcome=reconcile_dispute(pk)
        result[outcome]+=1
        if outcome=="held":
            Transaction.objects.filter(pk=pk).update(updated_at=timezone.now())
    from domains.reservation_recovery import run_due as release_abandoned
    result["processed"]+=release_abandoned(5)
    from domains.live_registration import run_due as run_domain,run_due_confirmed
    domain_result=run_domain()
    if domain_result in ("processed","held"):
        result[domain_result]+=1
    confirmed=run_due_confirmed()
    if confirmed in ("processed","held"):result[confirmed]+=1
    from domains.resellerclub_renewals import run_due as run_renewal,run_due_invoice
    renewal=run_renewal()
    if renewal in ("processed","held"): result[renewal]+=1
    issued=run_due_invoice()
    if issued in ("processed","held"):result[issued]+=1
    return result

class LiveReconciliationCronView(APIView):
    authentication_classes=[]
    permission_classes=[AllowAny]
    def get(self,request):
        key=os.environ.get("CRON_SECRET","")
        if len(key)<32 or not secrets.compare_digest(request.headers.get("Authorization","").encode(),("Bearer "+key).encode()):
            return Response({"detail":"Unauthorized."},status=401)
        from services.commercial_scheduler import enabled as commercial_enabled
        if commercial_enabled():
            return Response({"enabled":False,"state":"commercial_scheduler"},headers={"Cache-Control":"no-store"})
        return Response(run_due(),headers={"Cache-Control":"no-store"})
