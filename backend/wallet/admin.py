# wallet/admin.py

from django.contrib import admin
from .models import Wallet, WalletLedger, WithdrawalRequest, DepositRequest


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ['user', 'currency', 'balance', 'auto_pay_enabled', 'is_active']
    list_filter = ['currency', 'auto_pay_enabled', 'is_active']
    search_fields = ['user__email', 'user__full_name']
    readonly_fields = ['balance', 'created_at', 'updated_at']


@admin.register(WalletLedger)
class WalletLedgerAdmin(admin.ModelAdmin):
    list_display = ['user', 'transaction_type', 'amount', 'balance_after', 'created_at']
    list_filter = ['transaction_type', 'created_at']
    search_fields = ['user__email', 'description', 'reference']
    readonly_fields = ['created_at']
    
    def has_add_permission(self, request):
        return False


@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(admin.ModelAdmin):
    list_display = ['user', 'amount', 'bank_name', 'account_number', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['user__email', 'reference', 'account_number']
    readonly_fields = ['reference', 'created_at']
    
    actions = ['approve_withdrawals', 'reject_withdrawals']
    
    def approve_withdrawals(self, request, queryset):
        for withdrawal in queryset.filter(status='pending'):
            withdrawal.approve(processed_by=request.user)
        self.message_user(request, f"{queryset.count()} withdrawals approved")
    approve_withdrawals.short_description = "Approve selected withdrawals"
    
    def reject_withdrawals(self, request, queryset):
        for withdrawal in queryset.filter(status='pending'):
            withdrawal.reject("Rejected by admin", processed_by=request.user)
        self.message_user(request, f"{queryset.count()} withdrawals rejected")
    reject_withdrawals.short_description = "Reject selected withdrawals"


@admin.register(DepositRequest)
class DepositRequestAdmin(admin.ModelAdmin):
    list_display = ['user', 'amount', 'payment_method', 'receipt_number', 'status', 'created_at']
    list_filter = ['status', 'payment_method', 'created_at']
    search_fields = ['user__email', 'reference', 'receipt_number']
    readonly_fields = ['reference', 'created_at']
    
    actions = ['verify_deposits']
    
    def verify_deposits(self, request, queryset):
        for deposit in queryset.filter(status='pending'):
            deposit.verify(verified_by=request.user)
        self.message_user(request, f"{queryset.count()} deposits verified")
    verify_deposits.short_description = "Verify selected deposits"
