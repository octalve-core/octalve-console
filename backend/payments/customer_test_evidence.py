"""Read-only payment evidence shared by customer display and test rehearsals."""
from decimal import Decimal, InvalidOperation
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from audit.models import AuditLog
from payments.models import WebhookEvent, Transaction
from payments.domain_pilot_scope import CART, PILOT
from payments.hosted_checkout import payment_history, CheckoutRefused

def test_payment_evidence(invoice):
    if (invoice.status!="void" or invoice.amount_paid!=0 or not invoice.order_id
            or Transaction.objects.filter(invoice=invoice).exists()):
        return None
    order=invoice.order
    if (order.status!="needs_review" or order.client_id!=invoice.client_id
            or order.total!=invoice.total or order.currency!=invoice.currency):
        return None
    keys=[k for k in (CART,PILOT) if invoice.metadata.get(k) is True and isinstance(order.metadata.get(k),dict)]
    if len(keys)!=1:
        return None
    state=order.metadata[keys[0]]
    intents=list(invoice.payment_intents.filter(client_id=invoice.client_id,status="completed",
        amount=invoice.total,currency=invoice.currency,gateway__code="paystack",
        gateway__test_mode=True,gateway__status="test")[:2])
    if len(intents)!=1 or state.get("payment_reference")!=intents[0].reference:
        return None
    intent=intents[0]
    try:
        active,_=payment_history(invoice)
        if not active or active.pk!=intent.pk:
            return None
    except CheckoutRefused:
        return None
    events=list(WebhookEvent.objects.filter(gateway_id=intent.gateway_id,is_verified=True,
        event_type="charge.success",payload__intent_id=intent.pk,payload__reference=intent.reference)[:2])
    if len(events)!=1 or not events[0].is_processed or not events[0].processed_at:
        return None
    event=events[0]
    remote=event.payload.get("remote_id")
    if not isinstance(remote,str) or not remote.isascii() or not remote.isdecimal() or state.get("payment_remote_id") not in (None,"",remote):
        return None
    receipts=list(AuditLog.objects.filter(entity_type="HistoricalTestPayment",entity_id=str(event.pk),
        entity_name=invoice.public_reference,details__independent_verification=True,
        details__fulfillment_authorized=False,details__test=True,details__reference=intent.reference,
        details__remote_id=remote,details__currency=intent.currency)[:2])
    try:
        if len(receipts)==1:
            amount=Decimal(receipts[0].details.get("amount",""))
            if not amount.is_finite() or amount!=intent.amount:
                return None
            verified=parse_datetime(receipts[0].details.get("verified_at") or "")
        elif not receipts and state.get("payment_remote_id")==remote:
            verified=parse_datetime(state.get("payment_verified_at") or "")
        else:
            return None
        if not verified or timezone.is_naive(verified) or verified>timezone.now():
            return None
    except (InvalidOperation,TypeError,ValueError,OverflowError):
        return None
    return {"reference":intent.reference,"gateway":"paystack","verified_at":verified,
            "remote_id":remote,"test":True,"historical":bool(receipts)}
