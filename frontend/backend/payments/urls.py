# payments/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PaymentGatewayViewSet, TransactionViewSet,
    PaymentInitializeView, PaymentVerifyView, WebhookView
)

router = DefaultRouter()
router.register(r'gateways', PaymentGatewayViewSet, basename='payment-gateway')
router.register(r'transactions', TransactionViewSet, basename='transaction')

urlpatterns = [
    path('', include(router.urls)),
    path('initialize/', PaymentInitializeView.as_view(), name='payment-initialize'),
    path('verify/', PaymentVerifyView.as_view(), name='payment-verify'),
    path('webhook/<str:gateway_code>/', WebhookView.as_view(), name='payment-webhook'),
]