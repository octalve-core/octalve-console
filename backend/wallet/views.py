# wallet/views.py

from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
import secrets
import string
from .models import Wallet, WalletLedger, WithdrawalRequest, DepositRequest
from .serializers import (
    WalletSerializer, WalletLedgerSerializer, WithdrawalRequestSerializer,
    CreateWithdrawalSerializer, DepositRequestSerializer, CreateDepositSerializer,
    ApplyWalletToInvoiceSerializer
)
from billing.models import Invoice
from rbac.decorators import permission_required


class WalletViewSet(viewsets.GenericViewSet):
    """ViewSet for wallet operations"""
    
    serializer_class = WalletSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        wallet, created = Wallet.objects.get_or_create(
            user=self.request.user,
            defaults={'currency': 'NGN', 'balance': 0}
        )
        return wallet
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user's wallet"""
        wallet = self.get_object()
        serializer = self.get_serializer(wallet)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def update_settings(self, request):
        """Autopay preferences remain closed until their debit authority is qualified."""
        return Response(
            {'detail': 'Wallet payment preferences cannot be changed while automatic settlement is unavailable.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    @action(detail=False, methods=['get'])
    def ledger(self, request):
        """Get wallet ledger history"""
        wallet = self.get_object()
        ledger = WalletLedger.objects.filter(wallet=wallet).order_by('-created_at')
        
        # Pagination
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        start = (page - 1) * page_size
        end = start + page_size
        
        serializer = WalletLedgerSerializer(ledger[start:end], many=True)
        
        return Response({
            'results': serializer.data,
            'total': ledger.count(),
            'page': page,
            'page_size': page_size,
            'balance': wallet.balance
        })
    
    @action(detail=False, methods=['post'])
    def apply_to_invoice(self, request):
        """Do not settle invoices through an unqualified wallet shortcut.

        This endpoint stays present for compatibility but never debits funds,
        writes a ledger, marks an invoice paid or changes an order.
        """
        return Response(
            {'detail': 'Wallet invoice payments are unavailable until the verified settlement workflow is approved.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class WithdrawalRequestViewSet(mixins.CreateModelMixin, mixins.ListModelMixin,
                               mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """ViewSet for withdrawal requests"""
    
    serializer_class = WithdrawalRequestSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['user__email', 'user__full_name', 'reference']
    ordering = ['-created_at']
    
    # def get_queryset(self):
    #     user = self.request.user
    #     if user.role == 'admin' or user.is_superuser:
    #         return WithdrawalRequest.objects.all()
    #     return WithdrawalRequest.objects.filter(user=user)
    
    def get_queryset(self):
            # Prevent errors during OpenAPI schema generation
            if getattr(self, "swagger_fake_view", False):
                return WithdrawalRequest.objects.none()
    
            user = self.request.user
    
            # Defensive check (even though IsAuthenticated is used)
            if not user.is_authenticated:
                return WithdrawalRequest.objects.none()
    
            if user.is_superuser or getattr(user, "role", None) == "admin":
                return WithdrawalRequest.objects.all()
    
            return WithdrawalRequest.objects.filter(user=user)
    
    def create(self, request, *args, **kwargs):
        """Create a withdrawal request"""
        serializer = CreateWithdrawalSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        # Check if user has sufficient balance
        wallet = request.user.wallet
        amount = serializer.validated_data['amount']
        
        if wallet.balance < amount:
            return Response({'error': 'Insufficient wallet balance'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create withdrawal request (funds not deducted yet)
        withdrawal = WithdrawalRequest.objects.create(
            user=request.user,
            amount=amount,
            bank_name=serializer.validated_data['bank_name'],
            account_name=serializer.validated_data['account_name'],
            account_number=serializer.validated_data['account_number'],
            reference=self.generate_withdrawal_reference()
        )
        
        return Response(WithdrawalRequestSerializer(withdrawal).data, status=status.HTTP_201_CREATED)
    
    def generate_withdrawal_reference(self):
        """Generate unique withdrawal reference"""
        alphabet = string.ascii_uppercase + string.digits
        return 'WDR-' + ''.join(secrets.choice(alphabet) for _ in range(16))
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a pending withdrawal request"""
        withdrawal = self.get_object()
        
        if withdrawal.status != 'pending':
            return Response({'error': 'Only pending withdrawals can be cancelled'}, status=status.HTTP_400_BAD_REQUEST)
        
        withdrawal.cancel()
        return Response({'message': 'Withdrawal request cancelled'})


class DepositRequestViewSet(mixins.CreateModelMixin, mixins.ListModelMixin,
                            mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """ViewSet for deposit requests"""
    
    serializer_class = DepositRequestSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['user__email', 'user__full_name', 'reference']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return DepositRequest.objects.all()
        return DepositRequest.objects.filter(user=user)
    
    def create(self, request, *args, **kwargs):
        """Create a deposit request"""
        serializer = CreateDepositSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        deposit = DepositRequest.objects.create(
            user=request.user,
            amount=serializer.validated_data['amount'],
            payment_method=serializer.validated_data['payment_method'],
            receipt_number=serializer.validated_data.get('receipt_number', ''),
            reference=self.generate_deposit_reference()
        )
        
        return Response(DepositRequestSerializer(deposit).data, status=status.HTTP_201_CREATED)
    
    def generate_deposit_reference(self):
        """Generate unique deposit reference"""
        alphabet = string.ascii_uppercase + string.digits
        return 'DEP-' + ''.join(secrets.choice(alphabet) for _ in range(16))
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a pending deposit request"""
        deposit = self.get_object()
        
        if deposit.status != 'pending':
            return Response({'error': 'Only pending deposits can be cancelled'}, status=status.HTTP_400_BAD_REQUEST)
        
        deposit.cancel()
        return Response({'message': 'Deposit request cancelled'})


# Admin Views
class AdminWalletViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin view for all wallets"""
    
    queryset = Wallet.objects.all()
    serializer_class = WalletSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['currency', 'is_active']
    search_fields = ['user__email', 'user__full_name']
    ordering = ['-balance']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Wallet.objects.all()
        return Wallet.objects.none()
    
    @action(detail=True, methods=['post'])
    @permission_required('manage_finances')
    def manual_adjust(self, request, pk=None):
        """Manual balance changes require a separately reconciled ledger workflow."""
        return Response(
            {'detail': 'Manual wallet adjustments are unavailable until financial reconciliation is approved.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
