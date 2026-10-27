# providers/serializers.py

from rest_framework import serializers
from .models import Provider, ProviderPackage, ProviderLog, ProviderHealthCheck
from cryptography.fernet import Fernet
from django.conf import settings


class ProviderSerializer(serializers.ModelSerializer):
    """Serializer for Provider model"""
    
    # Write-only fields for API keys
    api_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    secret = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    # Read-only computed fields
    health_status_display = serializers.CharField(source='get_health_status_display', read_only=True)
    adapter_type_display = serializers.CharField(source='get_adapter_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    config = serializers.SerializerMethodField()
    metadata = serializers.SerializerMethodField()
    health_check_message = serializers.SerializerMethodField()

    def get_config(self, instance):
        source = instance.config if isinstance(instance.config, dict) else {}
        mode = source.get('fulfillment_model')
        return {'fulfillment_model':mode} if mode in ('owned_server','partner_reseller') else {}

    def get_metadata(self, instance):
        return {}

    def get_health_check_message(self, instance):
        msg = instance.health_check_message
        return msg if msg in ('Inventory access verified','Inventory test rejected or unavailable') else ''

    
    class Meta:
        model = Provider
        fields = [
            'id', 'name', 'adapter_type', 'adapter_type_display', 'description',
            'base_url', 'username', 'api_key', 'secret', 'server_group', 'config',
            'status', 'status_display', 'test_mode', 'health_status', 'health_status_display',
            'last_health_check', 'health_check_message', 'max_connections', 'timeout_seconds',
            'metadata', 'created_at', 'updated_at'
        ]
        read_only_fields = ['health_status', 'last_health_check', 'health_check_message', 
                           'created_at', 'updated_at']
    
    def create(self, validated_data):
        api_key = validated_data.pop('api_key', None)
        secret = validated_data.pop('secret', None)
        
        provider = super().create(validated_data)
        
        if api_key:
            provider.set_api_key(api_key)
        if secret:
            provider.set_secret(secret)
        
        provider.save()
        return provider
    
    def update(self, instance, validated_data):
        api_key = validated_data.pop('api_key', None)
        secret = validated_data.pop('secret', None)
        
        provider = super().update(instance, validated_data)
        
        if api_key:
            provider.set_api_key(api_key)
        if secret:
            provider.set_secret(secret)
        
        provider.save()
        return provider


class ProviderPackageSerializer(serializers.ModelSerializer):
    """Serializer for ProviderPackage model"""
    
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    
    class Meta:
        model = ProviderPackage
        fields = [
            'id', 'provider', 'provider_name', 'provider_package_id', 'name',
            'description', 'specs', 'pricing', 'is_active', 'last_synced_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['last_synced_at', 'created_at', 'updated_at']


class ProviderLogSerializer(serializers.ModelSerializer):
    metadata = serializers.SerializerMethodField()
    error_message = serializers.SerializerMethodField()

    def get_metadata(self, instance):
        return {}

    def get_error_message(self, instance):
        return 'Provider operation failed.' if instance.error_message else ''

    """Serializer for ProviderLog model"""
    
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    
    class Meta:
        model = ProviderLog
        fields = [
            'id', 'provider', 'provider_name', 'action', 'endpoint', 'method',
            'status_code', 'success', 'duration_ms', 'error_message',
            'metadata', 'created_at'
        ]
        read_only_fields = ['created_at']


class ProviderHealthCheckSerializer(serializers.ModelSerializer):
    """Serializer for ProviderHealthCheck model"""
    
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    
    class Meta:
        model = ProviderHealthCheck
        fields = [
            'id', 'provider', 'provider_name', 'status', 'response_time_ms',
            'message', 'checked_at'
        ]
        read_only_fields = ['checked_at']


class ProviderTestSerializer(serializers.Serializer):
    """Serializer for testing provider connection"""
    
    test_username = serializers.CharField(required=False, default='testuser')
    test_password = serializers.CharField(required=False, default='TestPass123!')
    test_domain = serializers.CharField(required=False, default='test.octalve.com')
    test_package = serializers.CharField(required=False, default='starter')
    test_email = serializers.EmailField(required=False, default='test@octalve.com')
