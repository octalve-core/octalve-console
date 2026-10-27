# providers/urls.py

from django.urls import path, include
from . import connection_views
from rest_framework.routers import DefaultRouter
from .views import ProviderViewSet, ProviderPackageViewSet, ProviderLogViewSet

router = DefaultRouter()
router.register(r'providers', ProviderViewSet, basename='provider')
router.register(r'packages', ProviderPackageViewSet, basename='provider-package')
router.register(r'logs', ProviderLogViewSet, basename='provider-log')

urlpatterns = [
    path("connections/schemas/", connection_views.connection_schemas, name="provider-connection-schemas"),
    path("connections/", connection_views.connections, name="provider-connections"),
    path("connections/<uuid:connection_id>/", connection_views.connection_detail, name="provider-connection-detail"),
    path("connections/<uuid:connection_id>/rotate/", connection_views.rotate_connection, name="provider-connection-rotate"),
    path("connections/<uuid:connection_id>/revoke/", connection_views.revoke_connection, name="provider-connection-revoke"),
    path('', include(router.urls)),
]