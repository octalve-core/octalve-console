# catalog/serializers.py

from rest_framework import serializers
from .models import ProductCategory, Product, Plan, PlanFeature, PlanBillingCycle, PlanProviderMapping

class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ['id', 'name', 'slug', 'description', 'icon', 'sort_order', 'is_active']

class PlanFeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanFeature
        fields = ['id', 'label', 'value', 'is_highlighted', 'sort_order']

class PlanBillingCycleSerializer(serializers.ModelSerializer):
    monthly_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    class Meta:
        model = PlanBillingCycle
        fields = ['id', 'cycle_key', 'label', 'months', 'price', 'regular_price', 
                  'discount_percent', 'setup_fee', 'monthly_price', 'is_default']

class PlanSerializer(serializers.ModelSerializer):
    features = PlanFeatureSerializer(many=True, read_only=True)
    billing_cycles = PlanBillingCycleSerializer(many=True, read_only=True)
    
    class Meta:
        model = Plan
        fields = ['id', 'product', 'name', 'slug', 'description', 'currency', 
                  'base_price', 'status', 'is_public', 'is_popular', 'sort_order',
                  'features', 'billing_cycles']

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    plans = PlanSerializer(many=True, read_only=True)
    
    class Meta:
        model = Product
        fields = ['id', 'category', 'category_name', 'name', 'slug', 'description',
                  'product_type', 'status', 'is_public', 'sort_order', 'image',
                  'features', 'plans']

class PlanProviderMappingSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    
    class Meta:
        model = PlanProviderMapping
        fields = ['id', 'plan', 'plan_name', 'provider_id', 'adapter_type',
                  'provider_package_id', 'provider_package_name', 'server_group',
                  'config', 'is_active']

