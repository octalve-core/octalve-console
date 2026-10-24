# payments/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
import hashlib
import hmac
import json
from .models import PaymentGateway, Transaction, PaymentIntent, WebhookEvent
from .signatures import verify_webhook_signature
from .serializers import (
    PaymentGatewaySerializer, TransactionSerializer, PaymentIntentSerializer,
    InitializePaymentSerializer, VerifyPaymentSerializer, WebhookPayloadSerializer
)
from billing.models import Invoice
from rbac.decorators import permission_required
import requests


class PaymentGatewayViewSet(viewsets.ModelViewSet):
    """ViewSet for payment gateways"""
    
    queryset = PaymentGateway.objects.all()
    serializer_class = PaymentGatewaySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return PaymentGateway.objects.all()
        return PaymentGateway.objects.filter(status='active')
    
    @permission_required('manage_settings')
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
    
    @permission_required('manage_settings')
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @permission_required('manage_settings')
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @permission_required('manage_settings')
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for transactions (read-only)"""
    
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'transaction_type']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Transaction.objects.all()
        return Transaction.objects.filter(client=user)


# Do not expose a half-implemented money movement API as production checkout.
# Full gateway adapters, signed notifications and atomic settlement will be
# reintroduced in a separately tested financial-authority release.
class PaymentInitializeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response(
            {'error': 'Checkout is not enabled.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class PaymentVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {'error': 'Payment verification is not enabled.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class WebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, gateway_code):
        # Deliberately reject external events without recording or settling.
        return Response(
            {'error': 'Payment webhook processing is not enabled.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
