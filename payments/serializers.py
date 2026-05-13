# payments/serializers.py

from rest_framework import serializers
from .models import PaymentGateway, Transaction, PaymentIntent


class PaymentGatewaySerializer(serializers.ModelSerializer):
    secret_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    webhook_secret = serializers.CharField(write_only=True, required=False, allow_blank=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = PaymentGateway
        fields = [
            'id', 'code', 'name', 'description', 'status', 'status_display',
            'test_mode', 'public_key', 'secret_key', 'webhook_secret',
            'config', 'sort_order', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def create(self, validated_data):
        secret_key = validated_data.pop('secret_key', None)
        webhook_secret = validated_data.pop('webhook_secret', None)
        
        gateway = super().create(validated_data)
        
        if secret_key:
            gateway.set_secret_key(secret_key)
        if webhook_secret:
            gateway.set_webhook_secret(webhook_secret)
        
        gateway.save()
        return gateway
    
    def update(self, instance, validated_data):
        secret_key = validated_data.pop('secret_key', None)
        webhook_secret = validated_data.pop('webhook_secret', None)
        
        gateway = super().update(instance, validated_data)
        
        if secret_key:
            gateway.set_secret_key(secret_key)
        if webhook_secret:
            gateway.set_webhook_secret(webhook_secret)
        
        gateway.save()
        return gateway


class TransactionSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    client_email = serializers.EmailField(source='client.email', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    gateway_name = serializers.CharField(source='gateway.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'reference', 'provider_reference', 'client_name', 'client_email',
            'invoice_number', 'gateway_name', 'transaction_type', 'currency',
            'amount', 'fee', 'net_amount', 'status', 'status_display',
            'payment_method', 'card_last4', 'card_type', 'paid_at', 'created_at'
        ]
        # read_only_fields = '__all__'
        read_only_fields = ['id', 'created_at']


class PaymentIntentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentIntent
        fields = ['id', 'reference', 'authorization_url', 'status', 'amount', 'currency', 'expires_at', 'created_at']
        # read_only_fields = '__all__'
        read_only_fields = ['id', 'created_at']


class InitializePaymentSerializer(serializers.Serializer):
    invoice_id = serializers.IntegerField()
    gateway_code = serializers.CharField()


class VerifyPaymentSerializer(serializers.Serializer):
    reference = serializers.CharField()


class WebhookPayloadSerializer(serializers.Serializer):
    pass