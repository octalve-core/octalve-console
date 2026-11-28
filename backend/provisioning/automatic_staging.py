"""Durable discovery of independently settled hosting lines.

The payment ledger is the source of truth; there is no browser trigger or
operator-selected order. This worker only stages local outbox records. No
supplier request, service activation, charge, or live gateway toggle.
"""
from datetime import timedelta
from django.conf import settings
from django.db import DatabaseError, transaction
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone
from orders.models import OrderItem
from provisioning.models import ProvisioningTask
from provisioning.fulfillment import stage_paid_order, FulfillmentRefused

KEY = "hosting_stage_retry_v1"


def enabled():
    return (getattr(settings,"CLOUD_FULFILLMENT_STAGING_ENABLED",False)
            and getattr(settings,"CLOUD_HOSTING_AUTO_STAGE_ENABLED",False)
            and getattr(settings,"CLOUD_SETTLEMENT_COMMIT_ENABLED",False))


def due_items(limit=10, *, order_id=None):
    if not enabled():
        return []
    limit = min(max(int(limit),1),20)
    now = timezone.now()
    existing = ProvisioningTask.objects.filter(order_item_id=OuterRef("pk"),
        action="provision",metadata__authority="verified_paid_order")
    # No repeated scanning of staged lines or unlimited traversal of held lines.
    rows=OrderItem.objects.filter(item_type="hosting",order__status="paid").exclude(order__source="renewal")
    if order_id is not None:
        rows=rows.filter(order_id=order_id)
    return list(rows
        .annotate(staged=Exists(existing)).filter(staged=False)
        .filter(Q(metadata__hosting_stage_retry_v1__next_at__isnull=True) |
                Q(metadata__hosting_stage_retry_v1__next_at__lte=now.isoformat()))
        .order_by("pk").values_list("pk","order_id")[:limit])


@transaction.atomic
def _hold(item_id):
    item=OrderItem.objects.select_for_update().filter(pk=item_id,order__status="paid",
        item_type="hosting").first()
    if not item or ProvisioningTask.objects.filter(order_item=item,action="provision",
            metadata__authority="verified_paid_order").exists():
        return
    prior=item.metadata.get(KEY,{})
    tries=prior.get("attempts",0) if isinstance(prior,dict) else 0
    tries=min(10000,tries+1) if type(tries) is int and tries>=0 else 1
    retry=timezone.now()+timedelta(minutes=min(360,2**min(tries,8)))
    # Never persist exception text, provider credentials, or customer data.
    item.metadata={**item.metadata,KEY:{"attempts":tries,"next_at":retry.isoformat(),
        "reason":"hosting_authority_or_supplier_unavailable"}}
    OrderItem.objects.filter(pk=item.pk).update(metadata=item.metadata,updated_at=timezone.now())


def run_due_staging(limit=10, *, order_id=None):
    result={"enabled":bool(enabled()),"staged":0,"held":0}
    for item_id,selected_order_id in due_items(limit,order_id=order_id):
        try:
            stage_paid_order(selected_order_id,item_id=item_id)
        except FulfillmentRefused:
            try:
                _hold(item_id)
            except DatabaseError:
                pass
            result["held"]+=1
        except DatabaseError:
            # Infrastructure failure must remain retryable, never be marked success.
            result["held"]+=1
        else:
            result["staged"]+=1
    return result


def stage_order_after_payment(order_id):
    """Fast path after COMMIT. A periodic scan recovers crashes and held work."""
    try:
        return run_due_staging(20,order_id=order_id)
    except DatabaseError:
        return {"enabled":bool(enabled()),"staged":0,"held":1}
