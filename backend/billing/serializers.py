# billing/serializers.py

from rest_framework import serializers
from django.utils import timezone
from .models import Invoice, InvoiceItem, Tax, Quote


class InvoiceItemSerializer(serializers.ModelSerializer):
    """Serializer for invoice items"""
    
    class Meta:
        model = InvoiceItem
        fields = [
            'id', 'description', 'product_id', 'plan_id', 'service_id',
            'domain_name', 'quantity', 'unit_price', 'subtotal',
            'period_start', 'period_end'
        ]
        read_only_fields = ['subtotal']


class InvoiceSerializer(serializers.ModelSerializer):
    """Serializer for invoices"""
    
    items = InvoiceItemSerializer(many=True, read_only=True)
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    client_email = serializers.EmailField(source='client.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_overdue = serializers.SerializerMethodField()
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'order', 'client', 'client_name', 'client_email',
            'status', 'status_display', 'currency', 'subtotal', 'discount_total',
            'tax_total', 'total', 'amount_paid', 'amount_due', 'issue_date',
            'due_date', 'paid_at', 'notes', 'items', 'is_overdue', 'created_at'
        ]
        read_only_fields = ['invoice_number', 'amount_paid', 'amount_due', 'created_at']
    
    def get_is_overdue(self, obj):
        # Serializing an invoice is read-only; do not mutate payment/status fields on GET.
        return obj.status in ('unpaid', 'overdue') and timezone.now() > obj.due_date


class TaxSerializer(serializers.ModelSerializer):
    """Serializer for taxes"""
    
    class Meta:
        model = Tax
        fields = ['id', 'name', 'rate', 'country', 'state', 'is_inclusive', 'is_active']


class QuoteSerializer(serializers.ModelSerializer):
    """Serializer for quotes"""
    
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    client_email = serializers.EmailField(source='client.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Quote
        fields = [
            'id', 'quote_number', 'client', 'client_name', 'client_email',
            'status', 'status_display', 'currency', 'subtotal', 'discount_total',
            'tax_total', 'total', 'issued_at', 'valid_until', 'accepted_at',
            'notes', 'items_data', 'created_at'
        ]
        read_only_fields = ['quote_number', 'created_at']


class CreateQuoteSerializer(serializers.Serializer):
    """Serializer for creating a quote"""
    
    items = serializers.ListField(child=serializers.DictField())
    notes = serializers.CharField(required=False, allow_blank=True)
    valid_days = serializers.IntegerField(default=7)
