# wallet/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WalletViewSet, WithdrawalRequestViewSet, DepositRequestViewSet, AdminWalletViewSet
)

router = DefaultRouter()
router.register(r'my-wallet', WalletViewSet, basename='my-wallet')
router.register(r'withdrawals', WithdrawalRequestViewSet, basename='withdrawal')
router.register(r'deposits', DepositRequestViewSet, basename='deposit')
router.register(r'admin/wallets', AdminWalletViewSet, basename='admin-wallet')

urlpatterns = [
    path('', include(router.urls)),
]