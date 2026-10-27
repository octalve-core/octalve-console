# domains/serializers.py

from rest_framework import serializers
from .models import (
    Domain, DomainNameserver, DNSRecord, TLDPricing, 
    DomainSearchLog, SSLCertificate
)


class DomainNameserverSerializer(serializers.ModelSerializer):
    """Serializer for domain nameservers"""
    
    class Meta:
        model = DomainNameserver
        fields = ['id', 'hostname', 'ip_address', 'sort_order']


class DNSRecordSerializer(serializers.ModelSerializer):
    """Serializer for DNS records"""
    
    record_type_display = serializers.CharField(source='get_record_type_display', read_only=True)
    
    class Meta:
        model = DNSRecord
        fields = [
            'id', 'record_type', 'record_type_display', 'name', 'value',
            'ttl', 'priority', 'service', 'protocol', 'port', 'weight',
            'is_active', 'created_at'
        ]
        read_only_fields = ['provider_record_id', 'created_at']


class DomainSerializer(serializers.ModelSerializer):
    """Serializer for domains"""
    
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    client_email = serializers.EmailField(source='client.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    days_until_expiry = serializers.SerializerMethodField()
    is_expiring_soon = serializers.SerializerMethodField()
    
    nameservers = DomainNameserverSerializer(many=True, read_only=True)
    dns_records = DNSRecordSerializer(many=True, read_only=True)
    
    class Meta:
        model = Domain
        fields = [
            'id', 'domain_name', 'tld', 'client', 'client_name', 'client_email',
            'status', 'status_display', 'registration_type', 'registrar',
            'registration_date', 'expiry_date', 'next_due_date', 'auto_renew',
            'dnssec_enabled', 'days_until_expiry', 'is_expiring_soon',
            'nameservers', 'dns_records', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'days_until_expiry', 'is_expiring_soon']
    
    def get_days_until_expiry(self, obj):
        return obj.days_until_expiry()
    
    def get_is_expiring_soon(self, obj):
        return obj.is_expiring_soon()


class TLDPricingSerializer(serializers.ModelSerializer):
    """Serializer for TLD pricing"""
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = TLDPricing
        fields = [
            'id', 'tld', 'description', 'register_price', 'transfer_price',
            'renewal_price', 'restore_price', 'redemption_price', 'epp_fee',
            'grace_period_days', 'redemption_period_days', 'requires_dnssec',
            'requires_id_protection', 'local_presence_required',
            'status', 'status_display', 'is_premium', 'sort_order'
        ]
        read_only_fields = ['id']


class DomainSearchSerializer(serializers.Serializer):
    """Serializer for domain search"""
    
    domain = serializers.CharField(max_length=255)
    tlds = serializers.ListField(child=serializers.CharField(), required=False)


class DomainCheckSerializer(serializers.Serializer):
    """Serializer for domain availability check"""
    
    domain_name = serializers.CharField(max_length=255)
    
    def validate_domain_name(self, value):
        import re
        if not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$', value):
            raise serializers.ValidationError("Invalid domain name format")
        return value.lower()


class DomainRegisterSerializer(serializers.Serializer):
    """Serializer for domain registration"""
    
    domain_name = serializers.CharField(max_length=255)
    years = serializers.IntegerField(default=1, min_value=1, max_value=10)
    nameservers = serializers.ListField(child=serializers.CharField(), required=False)
    registrant_contact = serializers.DictField()
    admin_contact = serializers.DictField(required=False)
    tech_contact = serializers.DictField(required=False)
    privacy_protection = serializers.BooleanField(default=False)


class DomainTransferSerializer(serializers.Serializer):
    """Serializer for domain transfer"""
    
    domain_name = serializers.CharField(max_length=255)
    epp_code = serializers.CharField(max_length=255)
    auth_code = serializers.CharField(max_length=255, required=False)


class DNSRecordCreateSerializer(serializers.Serializer):
    """Serializer for creating DNS records"""
    
    record_type = serializers.ChoiceField(choices=[
        ('A', 'A'), ('AAAA', 'AAAA'), ('CNAME', 'CNAME'),
        ('MX', 'MX'), ('TXT', 'TXT'), ('SRV', 'SRV')
    ])
    name = serializers.CharField(max_length=255)
    value = serializers.CharField()
    ttl = serializers.IntegerField(default=3600, min_value=60, max_value=86400)
    priority = serializers.IntegerField(required=False, min_value=0, max_value=100)


class SSLCertificateSerializer(serializers.ModelSerializer):
    """Serializer for SSL certificates"""
    
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    days_until_expiry = serializers.SerializerMethodField()
    
    class Meta:
        model = SSLCertificate
        fields = [
            'id', 'common_name', 'san_domains', 'certificate_type', 'domain',
            'client', 'client_name', 'status', 'status_display', 'issuer',
            'issued_at', 'expires_at', 'auto_renew', 'days_until_expiry',
            'validation_method', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'issued_at']
    
    def get_days_until_expiry(self, obj):
        return obj.days_until_expiry()


class SSLOrderSerializer(serializers.Serializer):
    """Serializer for ordering SSL certificates"""
    
    common_name = serializers.CharField(max_length=255)
    san_domains = serializers.ListField(child=serializers.CharField(), required=False)
    certificate_type = serializers.ChoiceField(choices=[
        ('dv', 'Domain Validation'),
        ('ov', 'Organization Validation'),
        ('wildcard', 'Wildcard SSL'),
    ])
    years = serializers.IntegerField(default=1, min_value=1, max_value=3)
