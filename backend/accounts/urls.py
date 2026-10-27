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

from .language_preferences import OwnLanguagePreferenceView
from .staff_roster import AdminStaffRosterView

from .account_self_service import (
    OwnProfileView, PasswordRecoveryRequestView,
    EmailVerificationRequestView, EmailVerificationConfirmView,
)

urlpatterns = [
    path('profile/', OwnProfileView.as_view(), name='self-service-profile'),
    path('language/', OwnLanguagePreferenceView.as_view(), name='own-language-preference'),
    path('staff/', AdminStaffRosterView.as_view(), name='admin-staff-roster'),
    path('email/verification/request/', EmailVerificationRequestView.as_view(), name='self-service-email-verify-request'),
    path('email/verification/confirm/', EmailVerificationConfirmView.as_view(), name='self-service-email-verify-confirm'),
    # Registered ahead of Djoser to ensure approved SMTP delivery, not file-based success.
    path('users/reset_password/', PasswordRecoveryRequestView.as_view(), name='self-service-reset-password'),
    # Custom JWT endpoints
    path('jwt/create/', CustomTokenObtainPairView.as_view(), name='jwt-create'),
    path('jwt/refresh/', CustomTokenRefreshView.as_view(), name='jwt-refresh'),
    path('jwt/verify/', TokenVerifyView.as_view(), name='jwt-verify'),
    path('logout/', CustomLogoutView.as_view(), name='logout'),
    path('me/', CustomUserInfoView.as_view(), name='user-info'),

    path('register/', CustomUserCreateView.as_view(), name='custom-register'),

    # Admin customer management
    path('customers/', AdminCustomerListView.as_view(), name='admin-customers'),
    path('customers/<int:id>/', AdminCustomerDetailView.as_view(), name='admin-customer-detail'),

]