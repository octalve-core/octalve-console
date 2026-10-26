"""
URL configuration for octalve_backend project.
"""
from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from .health import health

from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [
    path('api/health/', health, name='api-health'),
    # Admin
    path('admin/', admin.site.urls),

    # API Schema & Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # ------------------------------------------------------------------
    # Auth
    # 1) Custom auth routes FIRST so jwt/create hits CustomTokenObtainPairView
    #    (jwt/create, jwt/refresh, jwt/verify, logout, me, register, customers)
    # 2) Djoser AFTER, for password reset / set-password / user info only.
    #    NOTE: we do NOT include djoser.urls.jwt here — it would shadow our
    #    custom jwt endpoints and break session login / lockout / history.
    # ------------------------------------------------------------------
    path('api/auth/', include('accounts.urls')),
    re_path(r'^api/auth/', include('djoser.urls')),

    # Browsable API login/logout (adds the "Log in" link top-right)
    path('api-auth/', include('rest_framework.urls')),

    # App routes
    path('api/catalog/', include('catalog.urls')),
    path('api/orders/', include('orders.urls')),
    path('api/billing/', include('billing.urls')),
    path('api/providers/', include('providers.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/services/', include('services.urls')),
    path('api/integrations/opanel/v1/', include('opanel_bridge.urls')),
    path('api/provisioning/', include('provisioning.urls')),
    path('api/domains/', include('domains.urls')),
    path('api/support/', include('support.urls')),
    path('api/audit/', include('audit.urls')),
    path('api/settings/', include('settings_registry.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/wallet/', include('wallet.urls')),

    # Root → docs
    path('', RedirectView.as_view(url='/api/docs/', permanent=False)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
