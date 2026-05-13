# support/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SupportDepartmentViewSet, SupportTicketViewSet,
    PredefinedResponseViewSet, TicketEscalationRuleViewSet
)

router = DefaultRouter()
router.register(r'departments', SupportDepartmentViewSet, basename='support-department')
router.register(r'tickets', SupportTicketViewSet, basename='support-ticket')
router.register(r'predefined-responses', PredefinedResponseViewSet, basename='predefined-response')
router.register(r'escalation-rules', TicketEscalationRuleViewSet, basename='escalation-rule')

urlpatterns = [
    path('', include(router.urls)),
]