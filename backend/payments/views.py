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


class PaymentInitializeView(APIView):
    """Initialize payment with gateway"""
    
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Payment initialization is disabled until provider re-verification,
        # amount/currency reconciliation and atomic settlement are complete.
        return Response({'error': 'Checkout is not enabled.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        serializer = InitializePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        invoice_id = serializer.validated_data['invoice_id']
        gateway_code = serializer.validated_data['gateway_code']
        
        # Get invoice
        invoice = get_object_or_404(Invoice, id=invoice_id, client=request.user)
        
        # Check if invoice is already paid
        if invoice.status == 'paid':
            return Response({'error': 'Invoice already paid'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get gateway
        gateway = get_object_or_404(PaymentGateway, code=gateway_code, status='active')
        
        # Create payment intent
        intent = PaymentIntent.objects.create(
            invoice=invoice,
            client=request.user,
            gateway=gateway,
            reference=f"PAY-{timezone.now().strftime('%Y%m%d%H%M%S')}-{request.user.id}",
            amount=invoice.amount_due,
            currency=invoice.currency,
            expires_at=timezone.now() + timezone.timedelta(hours=24)
        )
        
        # Initialize based on gateway
        if gateway_code == 'paystack':
            result = self.initialize_paystack(gateway, invoice, intent)
        elif gateway_code == 'flutterwave':
            result = self.initialize_flutterwave(gateway, invoice, intent)
        else:
            return Response({'error': 'Unsupported gateway'}, status=status.HTTP_400_BAD_REQUEST)
        
        if result.get('success'):
            intent.authorization_url = result.get('authorization_url')
            intent.access_code = result.get('access_code')
            intent.status = 'processing'
            intent.save()
            
            return Response({
                'authorization_url': intent.authorization_url,
                'reference': intent.reference,
                'access_code': intent.access_code
            })
        else:
            intent.status = 'failed'
            intent.save()
            return Response({'error': result.get('error')}, status=status.HTTP_400_BAD_REQUEST)
    
    def initialize_paystack(self, gateway, invoice, intent):
        """Initialize Paystack payment"""
        secret_key = gateway.get_secret_key()
        
        if not secret_key:
            return {'success': False, 'error': 'Paystack secret key not configured'}
        
        headers = {
            'Authorization': f'Bearer {secret_key}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'email': invoice.client.email,
            'amount': int(invoice.amount_due * 100),  # Convert to kobo
            'reference': intent.reference,
            'callback_url': f"{settings.FRONTEND_URL}/payment/verify",
            'metadata': {
                'invoice_id': invoice.id,
                'client_id': invoice.client.id
            }
        }
        
        try:
            response = requests.post(
                'https://api.paystack.co/transaction/initialize',
                headers=headers,
                json=data,
                timeout=30
            )
            result = response.json()
            
            if result.get('status'):
                return {
                    'success': True,
                    'authorization_url': result['data']['authorization_url'],
                    'access_code': result['data']['access_code']
                }
            else:
                return {'success': False, 'error': result.get('message')}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def initialize_flutterwave(self, gateway, invoice, intent):
        """Initialize Flutterwave payment"""
        secret_key = gateway.get_secret_key()
        
        if not secret_key:
            return {'success': False, 'error': 'Flutterwave secret key not configured'}
        
        headers = {
            'Authorization': f'Bearer {secret_key}',
            'Content-Type': 'application/json'
        }
        
        data = {
            'tx_ref': intent.reference,
            'amount': str(invoice.amount_due),
            'currency': invoice.currency,
            'redirect_url': f"{settings.FRONTEND_URL}/payment/verify",
            'customer': {
                'email': invoice.client.email,
                'name': invoice.client.full_name
            },
            'customizations': {
                'title': 'Octalve Payment',
                'description': f'Invoice #{invoice.invoice_number}'
            }
        }
        
        try:
            response = requests.post(
                'https://api.flutterwave.com/v3/payments',
                headers=headers,
                json=data,
                timeout=30
            )
            result = response.json()
            
            if result.get('status') == 'success':
                return {
                    'success': True,
                    'authorization_url': result['data']['link'],
                    'access_code': result['data'].get('reference')
                }
            else:
                return {'success': False, 'error': result.get('message')}
        except Exception as e:
            return {'success': False, 'error': str(e)}


class PaymentVerifyView(APIView):
    """Verify payment after redirect"""
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        return Response({'error': 'Payment verification is not enabled.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        reference = request.query_params.get('reference')
        
        if not reference:
            return Response({'error': 'Reference required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            intent = PaymentIntent.objects.get(reference=reference, client=request.user)
        except PaymentIntent.DoesNotExist:
            return Response({'error': 'Payment intent not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Verify based on gateway
        if intent.gateway.code == 'paystack':
            result = self.verify_paystack(intent)
        elif intent.gateway.code == 'flutterwave':
            result = self.verify_flutterwave(intent)
        else:
            return Response({'error': 'Unsupported gateway'}, status=status.HTTP_400_BAD_REQUEST)
        
        if result.get('success'):
            # Do not treat provider status as settlement without independently
            # verifying amount, currency, reference and invoice identity.
            return Response({
                'success': False,
                'status': 'pending_reconciliation',
                'message': 'Payment requires verified reconciliation'
            }, status=status.HTTP_202_ACCEPTED)
        else:
            return Response({
                'success': False,
                'error': result.get('error')
            }, status=status.HTTP_400_BAD_REQUEST)
    
    def verify_paystack(self, intent):
        """Verify Paystack transaction"""
        secret_key = intent.gateway.get_secret_key()
        
        headers = {'Authorization': f'Bearer {secret_key}'}
        
        try:
            response = requests.get(
                f"https://api.paystack.co/transaction/verify/{intent.reference}",
                headers=headers,
                timeout=30
            )
            result = response.json()
            
            if result.get('status') and result['data']['status'] == 'success':
                return {
                    'success': True,
                    'provider_reference': result['data']['reference'],
                    'fee': result['data'].get('fees', 0) / 100,
                    'payment_method': result['data'].get('channel')
                }
            else:
                return {'success': False, 'error': result.get('message')}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def verify_flutterwave(self, intent):
        """Verify Flutterwave transaction"""
        secret_key = intent.gateway.get_secret_key()
        
        headers = {'Authorization': f'Bearer {secret_key}'}
        
        try:
            response = requests.get(
                f"https://api.flutterwave.com/v3/transactions/{intent.reference}/verify",
                headers=headers,
                timeout=30
            )
            result = response.json()
            
            if result.get('status') == 'success' and result['data']['status'] == 'successful':
                return {
                    'success': True,
                    'provider_reference': result['data']['reference'],
                    'fee': result['data'].get('fee', 0),
                    'payment_method': result['data'].get('payment_type')
                }
            else:
                return {'success': False, 'error': result.get('message')}
        except Exception as e:
            return {'success': False, 'error': str(e)}


class WebhookView(APIView):
    """Handle payment gateway webhooks"""
    
    permission_classes = [AllowAny]
    
    def post(self, request, gateway_code):
        # Do not ingest provider events before the settlement processor is ready.
        return Response({'error': 'Payment webhook processing is not enabled.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        gateway = get_object_or_404(PaymentGateway, code=gateway_code)
        # No unverified event or untrusted headers reach durable storage.
        if not self.verify_signature(gateway_code, request, gateway=gateway):
            return Response({'error': 'Invalid signature'}, status=status.HTTP_401_UNAUTHORIZED)
        payload = request.data
        if not isinstance(payload, dict):
            return Response({'error': 'Invalid payload'}, status=status.HTTP_400_BAD_REQUEST)
        # Scope deduplication by gateway; fingerprint when provider omits ID.
        source_id = payload.get('id') or payload.get('event_id') or hashlib.sha256(request.body).hexdigest()
        WebhookEvent.objects.get_or_create(
            event_id=f'{gateway_code}:{source_id}',
            defaults={
                'gateway': gateway,
                'event_type': payload.get('event', payload.get('event_type', 'unknown')),
                'payload': payload,
                'headers': {'content-type': request.headers.get('Content-Type', '')},
                'is_verified': True,
                'is_processed': False,
                'error_message': 'Pending provider reconciliation',
            },
        )
        # No successful financial state transition before provider requery.
        return Response({'status': 'pending_reconciliation'}, status=status.HTTP_202_ACCEPTED)
    
    def verify_signature(self, gateway_code, request, gateway=None):
        """Fail closed on missing credentials, unsupported gateways or malformed data."""
        try:
            configured = gateway or PaymentGateway.objects.get(code=gateway_code)
            return verify_webhook_signature(
                gateway_code, configured.get_webhook_secret(), request.headers, request.body
            )
        except (PaymentGateway.DoesNotExist, ValueError, TypeError):
            return False
    
    def process_paystack_webhook(self, event):
        """Process Paystack webhook"""
        payload = event.payload
        event_type = event.event_type
        
        if event_type == 'charge.success':
            reference = payload.get('data', {}).get('reference')
            try:
                intent = PaymentIntent.objects.get(reference=reference)
                
                # Create transaction
                Transaction.objects.create(
                    client=intent.client,
                    invoice=intent.invoice,
                    gateway=intent.gateway,
                    reference=reference,
                    provider_reference=payload['data'].get('reference'),
                    transaction_type='payment',
                    currency=intent.currency,
                    amount=intent.amount,
                    fee=payload['data'].get('fees', 0) / 100,
                    net_amount=intent.amount - (payload['data'].get('fees', 0) / 100),
                    status='successful',
                    payment_method=payload['data'].get('channel'),
                    webhook_payload=payload,
                    webhook_verified=True,
                    paid_at=timezone.now()
                )
                
                intent.status = 'completed'
                intent.save()
                
            except PaymentIntent.DoesNotExist:
                pass
    
    def process_flutterwave_webhook(self, event):
        """Process Flutterwave webhook"""
        payload = event.payload
        
        if payload.get('event') == 'charge.completed':
            reference = payload.get('data', {}).get('tx_ref')
            try:
                intent = PaymentIntent.objects.get(reference=reference)
                
                Transaction.objects.create(
                    client=intent.client,
                    invoice=intent.invoice,
                    gateway=intent.gateway,
                    reference=reference,
                    provider_reference=payload['data'].get('reference'),
                    transaction_type='payment',
                    currency=intent.currency,
                    amount=intent.amount,
                    fee=payload['data'].get('fee', 0),
                    net_amount=intent.amount - payload['data'].get('fee', 0),
                    status='successful',
                    payment_method=payload['data'].get('payment_type'),
                    webhook_payload=payload,
                    webhook_verified=True,
                    paid_at=timezone.now()
                )
                
                intent.status = 'completed'
                intent.save()
                
            except PaymentIntent.DoesNotExist:
                pass

