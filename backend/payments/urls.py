# payments/urls.py

from django.urls import path, include
from .vault_binding import admin_paystack_test_binding
from .live_binding import admin_live_binding
from .live_reconciliation import LiveReconciliationCronView
from .exception_views import financial_exception_review,refund_request
from .test_lifecycle_views import TestLifecycleCronView, TestLifecycleAdminView
from rest_framework.routers import DefaultRouter
from .views import (
    PaymentGatewayViewSet, TransactionViewSet,
    PaymentInitializeView, PaymentVerifyView, CheckoutOptionsView, GooglePayReviewConfigView, WebhookView
)

router = DefaultRouter()
router.register(r'gateways', PaymentGatewayViewSet, basename='payment-gateway')
router.register(r'transactions', TransactionViewSet, basename='transaction')

urlpatterns = [
    path("admin/refunds/request/",refund_request,name="admin-refund-request"),
    path("admin/financial-exceptions/",financial_exception_review,name="financial-exception-review"),
    path('test-lifecycle/cron/', TestLifecycleCronView.as_view(), name='test-lifecycle-cron'),
    path('admin/test-lifecycle/', TestLifecycleAdminView.as_view(), name='test-lifecycle-admin'),
    path("admin/paystack-test-binding/", admin_paystack_test_binding, name="paystack-test-binding"),
    path("admin/paystack-live-binding/", admin_live_binding, name="paystack-live-binding"),
    path("live-reconciliation/cron/", LiveReconciliationCronView.as_view(), name="live-reconciliation-cron"),
    path('', include(router.urls)),
    path('checkout-options/', CheckoutOptionsView.as_view(), name='payment-checkout-options'),
    path('initialize/', PaymentInitializeView.as_view(), name='payment-initialize'),
    path('verify/', PaymentVerifyView.as_view(), name='payment-verify'),
    path('google-pay/review-config/', GooglePayReviewConfigView.as_view(), name='google-pay-review-config'),
    path('webhook/<str:gateway_code>/', WebhookView.as_view(), name='payment-webhook'),
]