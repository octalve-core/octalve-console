# reports/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from .models import Metric
from .models import ReportDefinition

@receiver(post_save)
def update_metrics(sender, instance, created, **kwargs):
    """Update metrics when related models change"""
    if sender.__name__ == 'Invoice' and instance.status == 'paid':
        try:
            metric = Metric.objects.get(key='total_revenue')
            from billing.models import Invoice
            total = Invoice.objects.filter(status='paid').aggregate(Sum('total'))['total__sum'] or 0
            metric.update_value(total)
        except Metric.DoesNotExist:
            pass

@receiver(post_save)
def check_scheduled_reports(sender, instance, **kwargs):
    """Check if scheduled reports need to run"""
    if sender == ReportDefinition:
        if instance.auto_generate and instance.next_generation_at <= timezone.now():
            # This would trigger report generation
            pass
