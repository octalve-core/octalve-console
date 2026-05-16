# billing/admin.py

from django.contrib import admin
from .models import Invoice, InvoiceItem, Tax, Quote

class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 0
    readonly_fields = ['subtotal']

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'client', 'status', 'total', 'amount_due', 'issue_date', 'due_date']
    list_filter = ['status', 'issue_date', 'due_date']
    search_fields = ['invoice_number', 'client__email']
    readonly_fields = ['invoice_number', 'amount_paid', 'amount_due']
    inlines = [InvoiceItemInline]
    fieldsets = (
        ('Invoice Info', {
            'fields': ('invoice_number', 'order', 'client')
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Financial', {
            'fields': ('currency', 'subtotal', 'discount_total', 'tax_total', 'total', 'amount_paid', 'amount_due')
        }),
        ('Dates', {
            'fields': ('issue_date', 'due_date', 'paid_at')
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
    )

@admin.register(Tax)
class TaxAdmin(admin.ModelAdmin):
    list_display = ['name', 'rate', 'country', 'state', 'is_inclusive', 'is_active']
    list_filter = ['country', 'is_active']
    search_fields = ['name', 'country']

@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = ['quote_number', 'client', 'status', 'total', 'valid_until']
    list_filter = ['status']
    search_fields = ['quote_number', 'client__email']
