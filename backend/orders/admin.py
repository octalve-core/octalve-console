# orders/admin.py

from django.contrib import admin
from .models import Order, OrderItem, Coupon, CouponRedemption, Cart

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['subtotal']

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'client', 'status', 'total', 'created_at']
    list_filter = ['status', 'source', 'created_at']
    search_fields = ['order_number', 'client__email', 'client__full_name']
    readonly_fields = ['order_number', 'subtotal', 'discount_total', 'tax_total', 'total', 'created_at']
    inlines = [OrderItemInline]
    fieldsets = (
        ('Order Info', {
            'fields': ('order_number', 'client', 'status', 'source')
        }),
        ('Financial', {
            'fields': ('currency', 'subtotal', 'discount_total', 'tax_total', 'total')
        }),
        ('Coupon', {
            'fields': ('coupon_code', 'coupon_discount')
        }),
        ('Dates', {
            'fields': ('created_at', 'paid_at', 'provisioned_at')
        }),
        ('Metadata', {
            'fields': ('notes', 'ip_address', 'user_agent'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'discount_type', 'discount_value', 'used_count', 'max_uses', 'is_active']
    list_filter = ['discount_type', 'is_active']
    search_fields = ['code', 'name']
    readonly_fields = ['used_count', 'created_at']

@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ['id', 'session_key', 'client', 'updated_at']
    search_fields = ['session_key', 'client__email']

