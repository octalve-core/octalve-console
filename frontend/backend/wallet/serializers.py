# wallet/serializers.py

from rest_framework import serializers
from .models import Wallet, WalletLedger, WithdrawalRequest, DepositRequest


class WalletSerializer(serializers.ModelSerializer):
    """Serializer for wallet"""
    
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = Wallet
        fields = [
            'id', 'user', 'user_name', 'user_email', 'currency', 'balance',
            'auto_pay_enabled', 'auto_pay_threshold', 'low_balance_threshold',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['balance', 'created_at', 'updated_at']


class WalletLedgerSerializer(serializers.ModelSerializer):
    """Serializer for wallet ledger entries"""
    
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = WalletLedger
        fields = [
            'id', 'transaction_type', 'transaction_type_display', 'amount',
            'balance_before', 'balance_after', 'description', 'reference',
            'invoice_id', 'created_by_name', 'created_at'
        ]
        # read_only_fields = '__all__'
        read_only_fields = ['id', 'created_at']


class WithdrawalRequestSerializer(serializers.ModelSerializer):
    """Serializer for withdrawal requests"""
    
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = WithdrawalRequest
        fields = [
            'id', 'user', 'user_name', 'user_email', 'amount', 'currency',
            'bank_name', 'account_name', 'account_number', 'status',
            'status_display', 'rejection_reason', 'reference', 'created_at'
        ]
        read_only_fields = ['status', 'rejection_reason', 'reference', 'created_at']
    
    def validate_amount(self, value):
        if value < 100:
            raise serializers.ValidationError("Minimum withdrawal amount is 100")
        
        if hasattr(self, 'context') and 'request' in self.context:
            wallet = self.context['request'].user.wallet
            if wallet.balance < value:
                raise serializers.ValidationError(f"Insufficient balance. Available: {wallet.balance}")
        
        return value


class CreateWithdrawalSerializer(serializers.Serializer):
    """Serializer for creating withdrawal request"""
    
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    bank_name = serializers.CharField(max_length=100)
    account_name = serializers.CharField(max_length=200)
    account_number = serializers.CharField(max_length=20)


class DepositRequestSerializer(serializers.ModelSerializer):
    """Serializer for deposit requests"""
    
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = DepositRequest
        fields = [
            'id', 'user', 'user_name', 'user_email', 'amount', 'currency',
            'payment_method', 'reference', 'receipt_image', 'receipt_number',
            'status', 'status_display', 'notes', 'created_at'
        ]
        read_only_fields = ['status', 'reference', 'created_at']


class CreateDepositSerializer(serializers.Serializer):
    """Serializer for creating deposit request"""
    
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    payment_method = serializers.CharField(default='bank_transfer')
    receipt_number = serializers.CharField(required=False, allow_blank=True)
    
    def validate_amount(self, value):
        if value < 100:
            raise serializers.ValidationError("Minimum deposit amount is 100")
        return value


class ApplyWalletToInvoiceSerializer(serializers.Serializer):
    """Serializer for applying wallet to invoice"""
    
    invoice_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
