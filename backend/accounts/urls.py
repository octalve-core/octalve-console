# accounts/urls.py (create this file if not exists)

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from .views import (
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    CustomLogoutView,
    CustomUserInfoView,
    CustomUserCreateView,

    AdminCustomerListView,
    AdminCustomerDetailView,
)

urlpatterns = [
    # Custom JWT endpoints
    path('jwt/create/', CustomTokenObtainPairView.as_view(), name='jwt-create'),
    path('jwt/refresh/', CustomTokenRefreshView.as_view(), name='jwt-refresh'),
    path('jwt/verify/', TokenVerifyView.as_view(), name='jwt-verify'),
    path('logout/', CustomLogoutView.as_view(), name='logout'),
    path('me/', CustomUserInfoView.as_view(), name='user-info'),

    path('register/', CustomUserCreateView.as_view(), name='custom-register'),

    # Admin customer management
    path('admin/customers/', AdminCustomerListView.as_view(), name='admin-customers'),
    path('admin/customers/<int:id>/', AdminCustomerDetailView.as_view(), name='admin-customer-detail'),

]