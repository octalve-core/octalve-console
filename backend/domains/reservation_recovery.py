"""Release abandoned *local* registrar claims with no payment attempt.

An issued payment intent, even if expired, is never evidence that no charge
occurred. Preserve those orders for independent financial reconciliation.
The invoice and order remain as noncollectible historical documents.
"""
from datetime import timedelta
from django.core import signing
from django.db import transaction,DatabaseError
from django.utils import timezone
from audit.models import AuditLog
from billing.models import Invoice
from orders.models import Order,OrderItem
from payments.models import PaymentIntent,Transaction
from .models import Domain
from .live_registration import KEY,SALT,digest

MAX_AGE=timedelta(hours=24)

@transaction.atomic
def release(domain_id):
    candidate=Domain.objects.filter(pk=domain_id,status="pending",management_kind="registrar",
        registrar__in=("cloudflare-registrar-live","resellerclub"),created_at__lte=timezone.now()-MAX_AGE,
        metadata__live_domain_registration_v1__state="queued").first()
    if not candidate or not candidate.order_item_id:
        return False
    item=OrderItem.objects.get(pk=candidate.order_item_id)
    invoices=list(Invoice.objects.select_for_update().filter(order_id=item.order_id)[:2])
    if len(invoices)!=1:
        return False
    invoice=invoices[0]
    order=Order.objects.select_for_update().get(pk=item.order_id)
    from .live_cart import claims_for
    try:
        claims=claims_for(order)
        domains=list(Domain.objects.select_for_update().filter(pk__in=[c["domain_id"] for c in claims]).order_by("pk"))
        if len(domains)!=len(claims) or domain_id not in [d.pk for d in domains]:return False
        if (invoice.client_id!=order.client_id or order.status!="pending_payment" or order.paid_at
            or invoice.status not in ("unpaid","overdue") or invoice.paid_at or invoice.amount_paid!=0
            or invoice.amount_due!=invoice.total or order.total!=invoice.total
            or PaymentIntent.objects.filter(invoice=invoice).exists() or Transaction.objects.filter(invoice=invoice).exists()):
            return False
        for domain in domains:
            item=domain.order_item
            entry=domain.metadata[KEY];grant=signing.loads(entry["grant"],salt=SALT)
            if (domain.status!="pending" or domain.is_active or domain.service_id or domain.provider_id or domain.provider_domain_id
                or domain.registration_date or domain.expiry_date or domain.next_due_date or domain.created_at>timezone.now()-MAX_AGE
                or domain.registrar not in ("cloudflare-registrar-live","resellerclub") or domain.management_kind!="registrar"
                or domain.client_id!=order.client_id or not item or item.order_id!=order.pk or item.item_type!="domain"
                or item.domain_name!=domain.domain_name or {"domain_id":domain.pk,"item":item.pk} not in claims
                or entry["state"]!="queued" or entry.get("reserved_at") or entry.get("rc_stage")
                or grant["owner"]!=domain.client_id or grant["order"]!=order.pk or grant["item"]!=item.pk
                or grant["domain"]!=domain.domain_name or grant["contact_digest"]!=digest(domain.registrant_contact)):
                return False
            for relation in Domain._meta.related_objects:
                if relation.related_model._default_manager.filter(**{relation.field.name:domain}).exists():return False
        from services.models import Service
        from provisioning.models import ProvisioningTask
        if Service.objects.filter(order=order).exists() or ProvisioningTask.objects.filter(order=order).exists():return False
    except (signing.BadSignature,ValueError,TypeError,KeyError):
        return False
    receipt={"domains":[{"name":d.domain_name,"public_id":str(d.public_id)} for d in domains],"order":order.pk,"invoice":invoice.pk,
        "released_at":timezone.now().isoformat(),"reason":"unpaid_without_payment_attempt"}
    invoice.status="void";invoice.metadata={**invoice.metadata,"domain_reservation_release_v1":receipt}
    invoice.save(update_fields=["status","metadata","updated_at"])
    order.status="cancelled";order.metadata={**order.metadata,"domain_reservation_release_v1":receipt}
    order.save(update_fields=["status","metadata","updated_at"])
    for domain in domains:
        AuditLog.objects.create(actor=None,action="domain_reservation_released",entity_type="Domain",entity_id=str(domain.pk),entity_name=domain.domain_name,details=receipt)
        domain.delete()
    return True

def run_due(limit=5):
    # Exclude any payment history before selecting candidates to avoid starvation.
    from django.db.models import Exists,OuterRef
    intents=PaymentIntent.objects.filter(invoice__order_id=OuterRef("order_item__order_id"))
    movements=Transaction.objects.filter(invoice__order_id=OuterRef("order_item__order_id"))
    rows=Domain.objects.filter(status="pending",management_kind="registrar",registrar__in=("cloudflare-registrar-live","resellerclub"),
        created_at__lte=timezone.now()-MAX_AGE,metadata__live_domain_registration_v1__state="queued",
        order_item__order__status="pending_payment",service__isnull=True,provider__isnull=True
        ).annotate(has_intent=Exists(intents),has_movement=Exists(movements)).filter(
            has_intent=False,has_movement=False).order_by("updated_at","pk").values_list("pk",flat=True)[:min(max(int(limit),1),10)]
    count=0
    for pk in list(rows):
        try:
            if release(pk):
                count+=1
            else:
                Domain.objects.filter(pk=pk,status="pending").update(updated_at=timezone.now())
        except (DatabaseError,Domain.DoesNotExist,Order.DoesNotExist,OrderItem.DoesNotExist):
            continue
    return count
