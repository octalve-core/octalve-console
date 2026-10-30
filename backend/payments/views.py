# payments/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, BasePermission
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


class CloudGatewayAdminAccess(BasePermission):
    """Gateway configuration is separate from client checkout options."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and
                    (user.is_superuser or (user.is_staff and getattr(user, 'role', None) == 'admin')))


class PaymentGatewayViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for payment gateways"""
    
    queryset = PaymentGateway.objects.all()
    serializer_class = PaymentGatewaySerializer
    permission_classes = [IsAuthenticated, CloudGatewayAdminAccess]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or (user.is_staff and user.role == 'admin'):
            return PaymentGateway.objects.all()
        return PaymentGateway.objects.filter(status='active')
    


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for transactions (read-only)"""
    
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status', 'transaction_type']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or (user.is_staff and user.role == 'admin'):
            return Transaction.objects.all()
        return Transaction.objects.filter(client=user)


# Do not expose a half-implemented money movement API as production checkout.
# Full gateway adapters, signed notifications and atomic settlement will be
# reintroduced in a separately tested financial-authority release.
class PaymentInitializeView(APIView):
    """Exact-invoice hosted redirect URL, no client-supplied money or gateway key."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not getattr(settings, "CLOUD_HOSTED_CHECKOUT_HTTP_ENABLED", False):
            return Response({"error": "Checkout is not enabled."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        from .hosted_checkout import reserve_hosted_checkout, CheckoutRefused
        if getattr(request.user, "role", None) != "client":
            return Response({"error": "Customer checkout requires a client account."},
                            status=status.HTTP_403_FORBIDDEN)
        if not hasattr(request.data, "keys") or set(request.data.keys()) != {"invoice_id", "gateway"}:
            return Response({"error": "Only invoice_id and gateway are accepted."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            invoice_id = int(request.data["invoice_id"])
        except (ValueError, TypeError):
            return Response({"error": "Invalid invoice ID."},
                            status=status.HTTP_400_BAD_REQUEST)
        if invoice_id < 1 or str(invoice_id) != str(request.data["invoice_id"]):
            return Response({"error": "Invalid invoice ID."},
                            status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(request.data["gateway"], str) or request.data["gateway"] not in ("paystack", "flutterwave"):
            return Response({"error": "Invalid hosted gateway."},
                            status=status.HTTP_400_BAD_REQUEST)
        invoice = Invoice.objects.filter(pk=invoice_id, client=request.user).first()
        if invoice is None:
            return Response({"error": "Invoice not found."},
                            status=status.HTTP_404_NOT_FOUND)
        try:
            intent, created = reserve_hosted_checkout(
                invoice.pk, request.data["gateway"])
        except CheckoutRefused:
            return Response({"error": "Checkout needs verification or is unavailable."},
                            status=status.HTTP_409_CONFLICT)
        return Response({
            "invoice_id": invoice.pk,
            "status": "pending_payment",
            "checkout_url": intent.authorization_url,
            "reference": intent.reference,
            "expires_at": intent.expires_at.isoformat(),
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
                        headers={"Cache-Control": "no-store"})


class CheckoutOptionsView(APIView):
    """Read-only feature disclosure, never advertises unapproved payment providers."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        allowed = bool(
            getattr(settings, "CLOUD_HOSTED_CHECKOUT_HTTP_ENABLED", False)
            and getattr(settings, "CLOUD_HOSTED_CHECKOUT_ENABLED", False)
            and getattr(settings, "CLOUD_PAYMENT_STATUS_HTTP_ENABLED", False)
            and getattr(request.user, "role", None) == "client"
        )
        gateways = []
        if allowed:
            from .sandbox import gateway_can_read, secret_matches_mode
            for gateway in PaymentGateway.objects.filter(
                    code__in=("paystack", "flutterwave")):
                if (gateway_can_read(gateway)
                        and secret_matches_mode(gateway, gateway.get_secret_key())):
                    gateways.append(gateway.code)
        return Response(
            {"enabled": bool(gateways), "gateways": gateways,
             "currency": "NGN"},
            headers={"Cache-Control": "private, no-store"},
        )


class PaymentVerifyView(APIView):
    """Display only DB-backed paid/pending status; never trust redirect claims."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not getattr(settings, "CLOUD_PAYMENT_STATUS_HTTP_ENABLED", False):
            return Response({"error": "Payment status is not enabled."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            invoice_id = int(request.query_params.get("invoice_id", ""))
        except (ValueError, TypeError):
            return Response({"error": "Invalid invoice ID."}, status=400)
        if invoice_id < 1 or str(invoice_id) != request.query_params.get("invoice_id"):
            return Response({"error": "Invalid invoice ID."}, status=400)
        invoice = Invoice.objects.filter(pk=invoice_id, client=request.user).first()
        if invoice is None:
            return Response({"error": "Invoice not found."}, status=404)
        # A gateway redirect (success/tx_ref in query string) is ignored. Only
        # a previously committed internal settlement can change this status.
        return Response({"invoice_id": invoice.pk,
                         "invoice_status": invoice.status,
                         "amount_due": str(invoice.amount_due),
                         "currency": invoice.currency},
                        headers={"Cache-Control": "no-store"})

class WebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, gateway_code):
        # Only the separately gated, signature-authenticated inbox is public.
        # Even with ingest enabled, signed events NEVER settle, mark paid,
        # create a hosting service or call the provider.
        if not getattr(settings, "CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED", False):
            return Response({"error": "Payment webhook processing is not enabled."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        from .webhook_inbox import accept_signed_event, WebhookRejected
        try:
            event, created = accept_signed_event(
                gateway_code, request.body, request.headers)
        except WebhookRejected:
            return Response({"error": "Notification not accepted."},
                            status=status.HTTP_403_FORBIDDEN)
        return Response({"accepted": True}, status=status.HTTP_200_OK)
