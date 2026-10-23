# services/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from .models import Service, ServiceCredential
from billing.models import Invoice

@receiver(post_save, sender=Invoice)
def create_service_from_invoice(sender, instance, created, **kwargs):
    """Create service when invoice is paid for new order"""
    if instance.status == 'paid' and instance.order and instance.order.items.exists():
        for order_item in instance.order.items.all():
            # Check if service already exists
            if not Service.objects.filter(order_item=order_item).exists():
                # Get billing cycle from order item
                from catalog.models import PlanBillingCycle
                try:
                    billing_cycle = PlanBillingCycle.objects.get(id=order_item.billing_cycle_id)
                    
                    # Calculate next due date
                    if billing_cycle.cycle_key == 'once':
                        next_due_date = None
                    else:
                        next_due_date = timezone.now() + timezone.timedelta(days=billing_cycle.months * 30)
                    
                    Service.objects.create(
                        client=instance.client,
                        order_item=order_item,
                        order=instance.order,
                        invoice=instance,
                        product_id=order_item.product_id,
                        plan_id=order_item.plan_id,
                        service_type=order_item.item_type,
                        domain_name=order_item.domain_name,
                        label=order_item.description,
                        billing_cycle=billing_cycle.cycle_key,
                        amount=order_item.unit_price,
                        next_due_date=next_due_date,
                        status='pending'
                    )
                except PlanBillingCycle.DoesNotExist:
                    pass

