# orders/serializers.py

from decimal import Decimal
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
    offer_revision = serializers.IntegerField(required=False, min_value=1)
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
    checkout_id = serializers.UUIDField(required=True)
    
    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required")
        if len(value) > 20:
            raise serializers.ValidationError("Too many order items")
        
        validated_items = []
        for item in value:
            try:
                plan = Plan.objects.select_for_update().select_related('product').get(
                    id=item['plan_id'], status='active', is_public=True,
                    product__status='active', product__is_public=True,
                    product__category__is_active=True,
                )
                billing_cycle = PlanBillingCycle.objects.select_for_update().get(
                    plan=plan, 
                    cycle_key=item.get('cycle_key', '1mo'),
                    is_active=True
                )
                if plan.product.product_type not in ('shared_hosting', 'wordpress_hosting', 'vps'):
                    raise serializers.ValidationError('Only hosting plans can be ordered here')
                # A2 prices are versioned. Reject a stale checkout instead of
                # silently repricing a customer's previously displayed offer.
                # Older pre-A2 test/catalog plans remain compatible until migrated.
                from catalog.models import PublishedCatalogOffer, PlanProviderMapping
                from providers.models import ProviderPackage
                published = PublishedCatalogOffer.objects.filter(plan=plan).order_by('-revision').first()
                if published:
                    if item.get('offer_revision') != published.revision:
                        raise serializers.ValidationError(
                            'Catalog offer changed. Refresh your plan and reconfirm its price.'
                        )
                    quoted_cycle = next((
                        c for c in published.snapshot.get('billing_cycles', [])
                        if c['cycle_key'] == billing_cycle.cycle_key
                    ), None)
                    if not quoted_cycle or (
                        Decimal(str(quoted_cycle['price'])) != billing_cycle.price
                        or Decimal(str(quoted_cycle['setup_fee'])) != billing_cycle.setup_fee
                        or published.snapshot.get('currency') != plan.currency
                    ):
                        raise serializers.ValidationError('Published catalog amount is inconsistent; checkout disabled.')
                    mapping = PlanProviderMapping.objects.filter(
                        plan=plan, is_active=True,
                        provider_id=published.snapshot.get('supplier_provider_id'),
                        provider_package_id=published.snapshot.get('technical_package_id'),
                    ).first()
                    inventory = (ProviderPackage.objects.select_related('provider').filter(
                        pk=published.snapshot.get('supplier_inventory_id'),
                        provider_id=mapping.provider_id if mapping else None,
                        is_active=True, provider__status='active',
                        provider__health_status='healthy',
                    ).first())
                    if not mapping or not inventory:
                        raise serializers.ValidationError('Hosting supplier is not currently available.')
                    if inventory.provider.config.get('fulfillment_model') == 'partner_reseller':
                        wholesale = inventory.pricing
                        if wholesale.get('currency') != plan.currency:
                            raise serializers.ValidationError('Supplier cost currency no longer matches retail currency.')
                        try:
                            cost = Decimal(str(wholesale['cycles'][billing_cycle.cycle_key]))
                        except (ValueError, ArithmeticError, TypeError, KeyError):
                            raise serializers.ValidationError('Partner supplier cost is unavailable for checkout.')
                        if cost <= 0 or billing_cycle.price < cost:
                            raise serializers.ValidationError('Current supplier costs exceed approved retail price.')
                        item['supplier_cost'] = cost
                    item['published_catalog_offer'] = published
                item['item_type'] = 'vps' if plan.product.product_type == 'vps' else 'hosting'
                item['plan'] = plan
                item['billing_cycle'] = billing_cycle
                if billing_cycle.months < 1 or billing_cycle.price <= 0:
                    raise serializers.ValidationError('Billing cycle has invalid pricing')
                item['unit_price'] = billing_cycle.price + billing_cycle.setup_fee
                item['setup_fee'] = billing_cycle.setup_fee
                item['description'] = f"{plan.product.name} - {plan.name} ({billing_cycle.label})"
                if billing_cycle.setup_fee:
                    item['description'] += f" incl. {plan.currency} {billing_cycle.setup_fee} setup fee"
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
