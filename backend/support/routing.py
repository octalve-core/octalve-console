"""Dept-first, specialist-matched, lowest-active-load support assignment."""
from django.db.models import Count, Q
from django.contrib.auth import get_user_model

def eligible_staff(ticket):
    User=get_user_model()
    ids=ticket.department.assigned_staff.filter(
        is_active=True,role__in=("staff","admin")).values_list("pk",flat=True)
    query=User.objects.filter(pk__in=ids)
    if ticket.routing_tag_id:
        query=query.filter(support_routing_tags=ticket.routing_tag)
    return query.annotate(load=Count(
        "assigned_tickets",filter=Q(assigned_tickets__status__in=[
            "open","in_progress","waiting_staff","on_hold"]))).order_by("load","pk")

def choose_staff(ticket):
    return eligible_staff(ticket).first() if ticket.department.auto_assign else None
