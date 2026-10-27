# providers/urls.py

from django.urls import path, include
from . import connection_views,connection_security_views
from rest_framework.routers import DefaultRouter
from .views import ProviderViewSet, ProviderPackageViewSet, ProviderLogViewSet

router = DefaultRouter()
router.register(r'providers', ProviderViewSet, basename='provider')
router.register(r'packages', ProviderPackageViewSet, basename='provider-package')
router.register(r'logs', ProviderLogViewSet, basename='provider-log')

urlpatterns = [
    path("security/stepup/",connection_security_views.status,name="provider-security-status"),
    path("security/stepup/enroll/",connection_security_views.enroll,name="provider-security-enroll"),
    path("security/stepup/confirm/",connection_security_views.approve,name="provider-security-confirm"),
    path("connections/schemas/", connection_views.connection_schemas, name="provider-connection-schemas"),
    path("connections/", connection_views.connections, name="provider-connections"),
    path("connections/<uuid:connection_id>/", connection_views.connection_detail, name="provider-connection-detail"),
    path("connections/<uuid:connection_id>/rotate/", connection_views.rotate_connection, name="provider-connection-rotate"),
    path("connections/<uuid:connection_id>/revoke/", connection_views.revoke_connection, name="provider-connection-revoke"),
    path('', include(router.urls)),
]