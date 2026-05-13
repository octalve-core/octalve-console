"""
URL configuration for octalve_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, re_path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from accounts.views import CustomTokenObtainPairView
from django.views.generic import RedirectView

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),
    
    # API Schema & Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # Djoser Authentication Endpoints
    re_path(r'^api/auth/', include('djoser.urls')),
    re_path(r'^api/auth/', include('djoser.urls.jwt')),  # JWT endpoints through djoser
    
    # JWT Custom Endpoints (if using custom views)
    # path('api/auth/jwt/create/', CustomTokenObtainPairView.as_view(), name='jwt-create'),
    # path('api/auth/jwt/refresh/', TokenRefreshView.as_view(), name='jwt-refresh'),
    # path('api/auth/jwt/verify/', TokenVerifyView.as_view(), name='jwt-verify'),
    
    # Custom JWT endpoints (override djoser's jwt endpoints)
    path('api/auth/', include('accounts.urls')),
    path('api/catalog/', include('catalog.urls')),
    path('api/orders/', include('orders.urls')),
    path('api/billing/', include('billing.urls')),
    path('api/providers/', include('providers.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/client/services/', include('services.urls')),
    path('api/provisioning/', include('provisioning.urls')),
    path('api/domains/', include('domains.urls')),
    path('api/support/', include('support.urls')),
    path('api/audit/', include('audit.urls')),
    path('api/settings/', include('settings_registry.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/wallet/', include('wallet.urls')),

    # Optional: Redirect root to API docs
    path('', RedirectView.as_view(url='/api/docs/', permanent=False)),
]

