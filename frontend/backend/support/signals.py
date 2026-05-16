# support/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from .models import SupportTicket, TicketMessage, TicketEscalationRule
from notifications.utils import send_notification


@receiver(post_save, sender=TicketMessage)
def update_ticket_on_message(sender, instance, created, **kwargs):
    """Update ticket status when new message is added"""
    if created:
        ticket = instance.ticket
        
        # Update last reply
        ticket.last_reply_at = timezone.now()
        ticket.last_reply_by = instance.sender
        
        # Update status based on sender
        if instance.sender_role == 'client':
            ticket.status = 'waiting_staff'
        else:
            ticket.status = 'waiting_customer'
        
        ticket.save()


@receiver(post_save, sender=SupportTicket)
def check_escalation_rules(sender, instance, created, **kwargs):
    """Check and apply escalation rules"""
    if not created:
        rules = TicketEscalationRule.objects.filter(is_active=True)
        
        for rule in rules:
            apply = False
            
            if rule.condition_type == 'no_reply_time':
                hours = int(rule.condition_value)
                time_since = timezone.now() - instance.last_reply_at
                if time_since.total_seconds() > hours * 3600:
                    apply = True
                    
            elif rule.condition_type == 'priority':
                if instance.priority == rule.condition_value:
                    apply = True
                    
            elif rule.condition_type == 'department':
                if str(instance.department.id) == rule.condition_value:
                    apply = True
            
            if apply:
                if rule.action_type == 'change_priority':
                    instance.priority = rule.action_value
                    instance.save()
                elif rule.action_type == 'assign_staff' and rule.action_value:
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    try:
                        staff = User.objects.get(id=rule.action_value)
                        instance.assigned_to = staff
                        instance.save()
                    except User.DoesNotExist:
                        pass