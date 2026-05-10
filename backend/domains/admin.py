# domains/admin.py

from django.contrib import admin
from .models import Domain, DomainNameserver, DNSRecord, TLDPricing, DomainSearchLog, SSLCertificate


class DomainNameserverInline(admin.TabularInline):
    model = DomainNameserver
    extra = 0


class DNSRecordInline(admin.TabularInline):
    model = DNSRecord
    extra = 0
    fields = ['record_type', 'name', 'value', 'ttl']


@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ['domain_name', 'client', 'status', 'expiry_date', 'auto_renew']
    list_filter = ['status', 'tld', 'auto_renew']
    search_fields = ['domain_name', 'client__email']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [DomainNameserverInline, DNSRecordInline]
    fieldsets = (
        ('Domain Info', {
            'fields': ('domain_name', 'tld', 'client', 'status')
        }),
        ('Registration', {
            'fields': ('registration_type', 'registrar', 'provider_domain_id', 'registration_date', 'expiry_date')
        }),
        ('Renewal', {
            'fields': ('next_due_date', 'auto_renew', 'auto_renew_price')
        }),
        ('Security', {
            'fields': ('dnssec_enabled', 'dnssec_key'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
    )


@admin.register(TLDPricing)
class TLDPricingAdmin(admin.ModelAdmin):
    list_display = ['tld', 'register_price', 'transfer_price', 'renewal_price', 'status']
    list_filter = ['status', 'is_premium']
    search_fields = ['tld']


@admin.register(SSLCertificate)
class SSLCertificateAdmin(admin.ModelAdmin):
    list_display = ['common_name', 'client', 'certificate_type', 'status', 'expires_at']
    list_filter = ['status', 'certificate_type']
    search_fields = ['common_name', 'client__email']
