"""MFA-authorized financial closure; no refund or fulfillment override."""
from uuid import UUID
from django.db import transaction,DatabaseError
from django.db.models import Q
from django.utils import timezone
from audit.models import AuditLog
from providers.connection_stepup import check_mutation
from .models import Transaction,PaymentGateway,WebhookEvent
from .refund_authority import original_authorized,remote_refunds,remote_disputes,refund_rows,KEY as REFUND
from .dispute_authority import KEY as DISPUTE
from .financial_exceptions import EVENTS,ExceptionRefused,numeric_id,fetch_case,remote_transaction
from .live_binding import resolve_live_key

def event_rows(original):
    return WebhookEvent.objects.filter(gateway_id=original.gateway_id,is_verified=True,event_type__in=EVENTS,payload__mode="live").filter(
        Q(payload__transaction_id=original.provider_reference)|Q(payload__reference=original.reference))

def close(user,public_id,password,totp):
    from .live_reconciliation import enabled
    try:
        if not enabled(): raise ExceptionRefused()
        original=Transaction.objects.select_related("gateway").get(public_id=UUID(public_id),transaction_type="payment")
        if not original_authorized(original,original.gateway) or not original.metadata.get("financial_exception_review_required"):
            raise ExceptionRefused()
        check_mutation(user,password,totp)
        key=resolve_live_key(original.gateway)
        if not key: raise ExceptionRefused()
        event_snapshot=list(event_rows(original).order_by("pk").values_list("pk","is_processed")[:101])
        if any(not done for _,done in event_snapshot) or len(event_snapshot)>100:raise ExceptionRefused()
        refunds=remote_refunds(original,key);disputes=remote_disputes(original,key)
        if any(r["state"] not in ("failed","processed") for r in refunds): raise ExceptionRefused()
        # Independently read every dispute, not a merchant's asserted decision.
        final=[]
        liability=0
        seen=set()
        for d in disputes:
            case=numeric_id(d["id"]);proof=fetch_case("dispute",case,key)
            if proof.get("domain")!="live" or remote_transaction(proof.get("transaction"))!=original.provider_reference or numeric_id(proof.get("id"))!=case or proof.get("status")!="resolved":
                raise ExceptionRefused()
            if case in seen:raise ExceptionRefused()
            seen.add(case)
            amount=proof.get("refund_amount")
            resolution=proof.get("resolution")
            if resolution=="declined" and amount in (0,None):
                amount=0
            elif resolution in ("merchant-accepted","auto-accepted") and type(amount) is int and 0<amount<=int(original.amount*100) and proof.get("currency")==original.currency:
                liability+=amount
            else:raise ExceptionRefused("Unconfirmed dispute resolution or amount.")
            final.append({"case_id":case,"resolution":resolution,"amount_minor":amount})
        if liability>int(original.amount*100):raise ExceptionRefused()
        verified={r["id"]:r["amount_minor"] for r in refunds if r["state"]=="processed"}
        with transaction.atomic():
            gateway=PaymentGateway.objects.select_for_update().get(pk=original.gateway_id)
            locked=Transaction.objects.select_for_update().get(pk=original.pk)
            if (locked.metadata!=original.metadata or gateway.config!=original.gateway.config or resolve_live_key(gateway)!=key
                or not original_authorized(locked,gateway) or event_snapshot!=list(event_rows(locked).order_by("pk").values_list("pk","is_processed")[:101])
                or locked.metadata.get(REFUND,{}).get("state") in ("submitted","uncertain")
                or locked.metadata.get(DISPUTE,{}).get("state")=="uncertain"):
                raise ExceptionRefused()
            local={x.metadata.get("provider_refund_id"):int(x.amount*100) for x in refund_rows(locked)}
            if local!=verified:raise ExceptionRefused()
            # A processed refund can be closed for accounting, but must never
            # authorize new provisioning against an already returned payment.
            # Accepted disputes are booked as confirmed liabilities, not proof
            # of payout movement. Any overlap with refund receipts is displayed
            # separately; never deduct the same amount twice.
            clear=not verified and not liability
            receipt={"closed_at":timezone.now().isoformat(),"refund_cases":len(refunds),"dispute_cases":len(final),"dispute_liability_minor":liability,
                "disputes":final,"fulfillment_hold_retained":not clear,"cash_settlement_verified":False}
            locked.metadata={**locked.metadata,"financial_exception_review_required":not clear,"financial_exception_closure_v1":receipt}
            locked.save(update_fields=["metadata","updated_at"])
            AuditLog.objects.create(actor=user,action="payment_exception_closed",entity_type="Transaction",entity_id=str(locked.pk),entity_name="Paystack financial exception",details=receipt)
        return {"state":"closed","fulfillment_hold_retained":not clear}
    except (ExceptionRefused,ValueError,KeyError,TypeError,Transaction.DoesNotExist,PaymentGateway.DoesNotExist,DatabaseError):
        raise ExceptionRefused("Case cannot be closed until all financial evidence is reconciled.") from None
