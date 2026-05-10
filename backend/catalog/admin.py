# catalog/admin.py

from django.contrib import admin
from .models import ProductCategory, Product, Plan, PlanFeature, PlanBillingCycle, PlanProviderMapping

@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'sort_order', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    list_editable = ['sort_order', 'is_active']

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'product_type', 'status', 'is_public', 'sort_order']
    list_filter = ['category', 'product_type', 'status', 'is_public']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    list_editable = ['sort_order', 'status', 'is_public']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Basic Info', {
            'fields': ('category', 'name', 'slug', 'description', 'product_type')
        }),
        ('Status & Display', {
            'fields': ('status', 'is_public', 'sort_order', 'image')
        }),
        ('Features', {
            'fields': ('features',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ['name', 'product', 'base_price', 'currency', 'status', 'is_popular']
    list_filter = ['product', 'status', 'currency']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    list_editable = ['base_price', 'status', 'is_popular']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(PlanFeature)
class PlanFeatureAdmin(admin.ModelAdmin):
    list_display = ['plan', 'label', 'value', 'is_highlighted', 'sort_order']
    list_filter = ['plan', 'is_highlighted']
    search_fields = ['label', 'value']
    list_editable = ['is_highlighted', 'sort_order']

@admin.register(PlanBillingCycle)
class PlanBillingCycleAdmin(admin.ModelAdmin):
    list_display = ['plan', 'cycle_key', 'label', 'price', 'setup_fee', 'is_active', 'is_default']
    list_filter = ['plan', 'cycle_key', 'is_active']
    search_fields = ['plan__name']
    list_editable = ['price', 'setup_fee', 'is_active', 'is_default']
    readonly_fields = ['monthly_price']

@admin.register(PlanProviderMapping)
class PlanProviderMappingAdmin(admin.ModelAdmin):
    list_display = ['plan', 'adapter_type', 'provider_package_name', 'is_active']
    list_filter = ['adapter_type', 'is_active']
    search_fields = ['plan__name', 'provider_package_name']
    list_editable = ['is_active']
