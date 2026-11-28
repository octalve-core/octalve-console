# providers/urls.py

from django.urls import path, include
from domains.registrar_reauthorization import reauthorize_view
from . import registrar_live_policy,mail_policy_views,hosting_policy_views,connection_views,connection_security_views,cloudflare_int01_views,connection_verification,connection_registrar_views
from rest_framework.routers import DefaultRouter
from .views import ProviderViewSet, ProviderPackageViewSet, ProviderLogViewSet

router = DefaultRouter()
router.register(r'providers', ProviderViewSet, basename='provider')
router.register(r'packages', ProviderPackageViewSet, basename='provider-package')
router.register(r'logs', ProviderLogViewSet, basename='provider-log')

urlpatterns = [
    path("int01/cloudflare/probe/",cloudflare_int01_views.probe,name="int01-cloudflare-probe"),
    path("security/stepup/",connection_security_views.status,name="provider-security-status"),
    path("security/stepup/enroll/",connection_security_views.enroll,name="provider-security-enroll"),
    path("security/stepup/confirm/",connection_security_views.approve,name="provider-security-confirm"),
    path("connections/schemas/", connection_views.connection_schemas, name="provider-connection-schemas"),
    path("connections/", connection_views.connections, name="provider-connections"),
    path("connections/<uuid:connection_id>/", connection_views.connection_detail, name="provider-connection-detail"),
    path("connections/<uuid:connection_id>/mail-policy/",mail_policy_views.configure_sender,name="mail-sender-policy"),
    path("connections/<uuid:connection_id>/hosting-policy/",hosting_policy_views.configure_execution,name="hosting-policy"),
    path("connections/<uuid:connection_id>/verify/",connection_verification.verify_connection,name="provider-connection-verify"),
    path("connections/<uuid:connection_id>/registrar-registration-status/",connection_registrar_views.live_registration_status,name="provider-live-registration-status"),
    path("connections/<uuid:connection_id>/registrar-reauthorize/",reauthorize_view,name="registrar-resource-reauthorize"),
    path("connections/<uuid:connection_id>/registrar-policy/",registrar_live_policy.configure,name="registrar-live-policy"),
    path("connections/<uuid:connection_id>/registrar-quote/",connection_registrar_views.live_registrar_quote,name="provider-live-registrar-quote"),
    path("connections/<uuid:connection_id>/rotate/", connection_views.rotate_connection, name="provider-connection-rotate"),
    path("connections/<uuid:connection_id>/revoke/", connection_views.revoke_connection, name="provider-connection-revoke"),
    path('', include(router.urls)),
]