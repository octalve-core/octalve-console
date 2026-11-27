# billing/serializers.py

from django.conf import settings
from rest_framework import serializers
from django.utils import timezone
from .models import Invoice, InvoiceItem, Tax, Quote
from .item_periods import confirmed_period


class InvoiceItemSerializer(serializers.ModelSerializer):
    """Serializer for invoice items"""

    confirmed_period = serializers.SerializerMethodField()

    def get_confirmed_period(self, item):
        return confirmed_period(item)
    
    class Meta:
        model = InvoiceItem
        fields = [
            'id', 'description', 'product_id', 'plan_id', 'service_id',
            'domain_name', 'quantity', 'unit_price', 'subtotal',
            'period_start', 'period_end', 'confirmed_period'
        ]
        read_only_fields = ['subtotal']


class InvoiceSerializer(serializers.ModelSerializer):
    """Serializer for invoices"""
    
    items = InvoiceItemSerializer(many=True, read_only=True)
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    client_email = serializers.EmailField(source='client.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_overdue = serializers.SerializerMethodField()
    amount_due = serializers.DecimalField(source="collectible_amount", max_digits=12, decimal_places=2, read_only=True)
    payment_action_allowed = serializers.SerializerMethodField()
    payment_resume = serializers.SerializerMethodField()
    checkout_context = serializers.SerializerMethodField()
    payment_attempt = serializers.SerializerMethodField()
    test_checkout_status = serializers.SerializerMethodField()
    payment_reference = serializers.SerializerMethodField()
    payment_details = serializers.SerializerMethodField()
    order_number = serializers.CharField(source="order.order_number", read_only=True, default=None)

    def get_payment_details(self, obj):
        from .payment_reference import verified_payment_details
        return verified_payment_details(obj)

    def get_payment_reference(self, obj):
        from .payment_reference import verified_payment_details
        return (verified_payment_details(obj) or {}).get("reference")
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'order', 'client', 'client_name', 'client_email',
            'status', 'status_display', 'currency', 'subtotal', 'discount_total',
            'tax_total', 'total', 'amount_paid', 'amount_due', 'issue_date',
            'due_date', 'paid_at', 'notes', 'items', 'is_overdue', 'created_at', 'payment_action_allowed', 'payment_resume', 'checkout_context', 'payment_attempt', 'test_checkout_status', 'payment_reference', 'payment_details', 'order_number'
        ]
        read_only_fields = ['invoice_number', 'amount_paid', 'amount_due', 'created_at']
    
    def get_is_overdue(self, obj):
        # Serializing an invoice is read-only; do not mutate payment/status fields on GET.
        return obj.status in ('unpaid', 'overdue') and timezone.now() > obj.due_date

    def get_payment_action_allowed(self, obj):
        from payments.domain_pilot_scope import is_pilot_invoice

        return obj.status == "unpaid" and obj.collectible_amount > 0 and not is_pilot_invoice(obj)

    def get_test_checkout_status(self, obj):
        from payments.domain_pilot_scope import CART
        return bool(obj.status == "void" and obj.metadata.get(CART) is True and obj.order_id
                    and obj.client_id == obj.order.client_id and obj.order.status == "needs_review")

    def get_payment_attempt(self, obj):
        from payments.hosted_checkout import payment_attempt_summary
        if obj.status != "unpaid" or getattr(self.context.get("view"), "action", None) == "list":
            return None
        return payment_attempt_summary(obj)

    def get_checkout_context(self, obj):
        """Route only an existing invoice; never permission to pay."""
        from payments.domain_pilot_scope import CART, PILOT, pilot_configuration, selected_domain_test_account_allowed, selected_domain_test_allowed, public_payment_test_account_allowed, public_domain_payment_test_allowed
        if not obj.order_id or obj.order.client_id != obj.client_id:
            return {"kind": "invoice"}
        snapshot = obj.order.metadata or {}
        if obj.metadata.get(CART) is True and isinstance(snapshot.get(CART), dict):
            public = snapshot[CART].get("public_payment_test") is True
            allowed = public_payment_test_account_allowed(obj.client) if public else selected_domain_test_account_allowed(obj.client)
            if allowed:
                return {"kind": "combined_domain"}
        if obj.metadata.get(PILOT) is True and isinstance(snapshot.get(PILOT), dict):
            pilot = snapshot[PILOT]
            domain = pilot.get("domain")
            if pilot.get("selected_domain") is True:
                allowed = public_domain_payment_test_allowed(obj.client, domain) if pilot.get("public_payment_test") is True else selected_domain_test_allowed(obj.client, domain)
                if allowed:
                    return {"kind": "domain", "domain": domain}
            elif pilot_configuration() == (obj.client_id, domain):
                return {"kind": "legacy_domain"}
        return {"kind": "invoice"}

    def get_payment_resume(self, obj):
        from payments.domain_pilot_scope import CART, PILOT, is_pilot_invoice, pilot_configuration, selected_domain_test_allowed, public_domain_payment_test_allowed

        if (obj.status != "unpaid" or obj.collectible_amount <= 0 or not obj.order_id
                or obj.order.client_id != obj.client_id or obj.order.status != "pending_payment"):
            return None
        if is_pilot_invoice(obj):
            if obj.metadata.get(CART) is True:
                context = self.get_checkout_context(obj)
                return context if context["kind"] == "combined_domain" else None
            snapshot = obj.order.metadata.get(PILOT, {}) if isinstance(obj.order.metadata, dict) else {}
            if not isinstance(snapshot, dict) or snapshot.get("state") != "awaiting_payment":
                return None
            domain = snapshot.get("domain")
            if snapshot.get("selected_domain") is True and (public_domain_payment_test_allowed(obj.client, domain) if snapshot.get("public_payment_test") is True else selected_domain_test_allowed(obj.client, domain)):
                return {"kind": "domain", "domain": domain}
            if snapshot.get("selected_domain") is not True and pilot_configuration() == (obj.client_id, domain):
                return {"kind": "legacy_domain"}
            return None
        if (settings.CLOUD_HOSTED_CHECKOUT_HTTP_ENABLED and settings.CLOUD_HOSTED_CHECKOUT_ENABLED
                and settings.CLOUD_PAYMENT_STATUS_HTTP_ENABLED and obj.currency == "NGN"
                and obj.amount_paid == 0 and obj.amount_due == obj.total == obj.order.total):
            return {"kind": "invoice"}
        return None


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
