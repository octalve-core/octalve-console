# audit/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AuditLogViewSet, LoginAttemptViewSet, APIAccessLogViewSet,
    SecurityEventViewSet, DataExportLogViewSet
)

router = DefaultRouter()
router.register(r'logs', AuditLogViewSet, basename='audit-log')
router.register(r'login-attempts', LoginAttemptViewSet, basename='login-attempt')
router.register(r'api-logs', APIAccessLogViewSet, basename='api-log')
router.register(r'security-events', SecurityEventViewSet, basename='security-event')
router.register(r'data-exports', DataExportLogViewSet, basename='data-export')

urlpatterns = [
    path('', include(router.urls)),
]