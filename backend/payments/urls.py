# payments/urls.py

from django.urls import path, include
from .vault_binding import admin_paystack_test_binding
from rest_framework.routers import DefaultRouter
from .views import (
    PaymentGatewayViewSet, TransactionViewSet,
    PaymentInitializeView, PaymentVerifyView, CheckoutOptionsView, GooglePayReviewConfigView, WebhookView
)

router = DefaultRouter()
router.register(r'gateways', PaymentGatewayViewSet, basename='payment-gateway')
router.register(r'transactions', TransactionViewSet, basename='transaction')

urlpatterns = [
    path("admin/paystack-test-binding/", admin_paystack_test_binding, name="paystack-test-binding"),
    path('', include(router.urls)),
    path('checkout-options/', CheckoutOptionsView.as_view(), name='payment-checkout-options'),
    path('initialize/', PaymentInitializeView.as_view(), name='payment-initialize'),
    path('verify/', PaymentVerifyView.as_view(), name='payment-verify'),
    path('google-pay/review-config/', GooglePayReviewConfigView.as_view(), name='google-pay-review-config'),
    path('webhook/<str:gateway_code>/', WebhookView.as_view(), name='payment-webhook'),
]