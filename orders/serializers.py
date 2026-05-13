# orders/serializers.py

from rest_framework import serializers
from django.conf import settings
from .models import Order, OrderItem, Coupon, CouponRedemption, Cart
from catalog.models import Plan, PlanBillingCycle


class OrderItemSerializer(serializers.ModelSerializer):
    """Serializer for order items"""
    
    product_name = serializers.SerializerMethodField()
    plan_name = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderItem
        fields = [
            'id', 'item_type', 'description', 'domain_name', 'quantity',
            'unit_price', 'subtotal', 'cycle_key', 'months', 'config',
            'product_id', 'plan_id', 'product_name', 'plan_name'
        ]
        read_only_fields = ['subtotal']
    
    def get_product_name(self, obj):
        from catalog.models import Product
        try:
            product = Product.objects.get(id=obj.product_id)
            return product.name
        except:
            return None
    
    def get_plan_name(self, obj):
        from catalog.models import Plan
        try:
            plan = Plan.objects.get(id=obj.plan_id)
            return plan.name
        except:
            return None


class OrderSerializer(serializers.ModelSerializer):
    """Serializer for orders"""
    
    items = OrderItemSerializer(many=True, read_only=True)
    client_email = serializers.EmailField(source='client.email', read_only=True)
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'client', 'client_email', 'client_name',
            'status', 'status_display', 'source', 'currency', 'subtotal',
            'discount_total', 'tax_total', 'total', 'coupon_code',
            'coupon_discount', 'notes', 'created_at', 'paid_at',
            'provisioned_at', 'items'
        ]
        read_only_fields = ['order_number', 'created_at', 'paid_at', 'provisioned_at']


class CreateOrderItemSerializer(serializers.Serializer):
    """Serializer for creating order items"""
    
    plan_id = serializers.IntegerField()
    cycle_key = serializers.CharField(default='1mo')
    quantity = serializers.IntegerField(default=1, min_value=1)
    domain_name = serializers.CharField(required=False, allow_blank=True)
    item_type = serializers.CharField(default='hosting')
    config = serializers.JSONField(required=False, default=dict)


class CreateOrderSerializer(serializers.Serializer):
    """Serializer for creating an order from cart"""
    
    items = CreateOrderItemSerializer(many=True)
    coupon_code = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required")
        
        validated_items = []
        for item in value:
            try:
                plan = Plan.objects.get(id=item['plan_id'], status='active')
                billing_cycle = PlanBillingCycle.objects.get(
                    plan=plan, 
                    cycle_key=item.get('cycle_key', '1mo'),
                    is_active=True
                )
                item['plan'] = plan
                item['billing_cycle'] = billing_cycle
                item['unit_price'] = billing_cycle.price
                item['description'] = f"{plan.product.name} - {plan.name} ({billing_cycle.label})"
                validated_items.append(item)
            except Plan.DoesNotExist:
                raise serializers.ValidationError(f"Plan {item['plan_id']} not found")
            except PlanBillingCycle.DoesNotExist:
                raise serializers.ValidationError(f"Billing cycle not found for plan {item['plan_id']}")
        
        return validated_items
    
    def validate_coupon_code(self, value):
        if value:
            try:
                coupon = Coupon.objects.get(code=value.upper(), is_active=True)
                self.context['coupon'] = coupon
            except Coupon.DoesNotExist:
                raise serializers.ValidationError("Invalid coupon code")
        return value


class CouponSerializer(serializers.ModelSerializer):
    """Serializer for coupons"""
    
    discount_type_display = serializers.CharField(source='get_discount_type_display', read_only=True)
    
    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'name', 'description', 'discount_type',
            'discount_type_display', 'discount_value', 'max_uses',
            'used_count', 'max_uses_per_client', 'min_order_amount',
            'applicable_products', 'applicable_plans', 'starts_at',
            'ends_at', 'is_active', 'created_at'
        ]
        read_only_fields = ['used_count', 'created_at']


class ValidateCouponSerializer(serializers.Serializer):
    """Serializer for coupon validation"""
    
    code = serializers.CharField(max_length=50)
    order_amount = serializers.DecimalField(max_digits=12, decimal_places=2)


class CartItemSerializer(serializers.Serializer):
    """Serializer for cart items"""
    
    plan_id = serializers.IntegerField()
    plan_name = serializers.CharField(read_only=True)
    cycle_key = serializers.CharField(default='1mo')
    quantity = serializers.IntegerField(default=1, min_value=1)
    domain_name = serializers.CharField(required=False, allow_blank=True)
    price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    def validate_plan_id(self, value):
        try:
            plan = Plan.objects.get(id=value, status='active')
            return value
        except Plan.DoesNotExist:
            raise serializers.ValidationError("Plan not found")


class CartSerializer(serializers.ModelSerializer):
    """Serializer for cart"""
    
    items = serializers.ListField(child=CartItemSerializer())
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    class Meta:
        model = Cart
        fields = ['id', 'items', 'coupon_code', 'total', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
