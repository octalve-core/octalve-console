from django.contrib import admin
from .models import (RewardPolicy,RewardTier,PointEntry,AffiliateAccount,
                     ReferralAttribution,CommissionEntry,ClientRecognition)

@admin.register(RewardPolicy)
class RewardPolicyAdmin(admin.ModelAdmin):
    list_display=("name","is_active","min_eligible_points","max_discount_percent","redemption_enabled")
    def has_delete_permission(self,request,obj=None):return False

@admin.register(RewardTier)
class RewardTierAdmin(admin.ModelAdmin):
    list_display=("title","required_points","discount_percent","enabled")
    def has_delete_permission(self,request,obj=None):return False

@admin.register(AffiliateAccount)
class AffiliateAccountAdmin(admin.ModelAdmin):
    list_display=("user_id","status","terms_version","created_at")
    list_filter=("status",)
    readonly_fields=("user","terms_version","accepted_at","created_at")
    def has_add_permission(self,request):return False
    def has_delete_permission(self,request,obj=None):return False

class ImmutableAdmin(admin.ModelAdmin):
    def has_add_permission(self,request):return False
    def has_change_permission(self,request,obj=None):return False
    def has_delete_permission(self,request,obj=None):return False

admin.site.register(PointEntry,ImmutableAdmin)
admin.site.register(ReferralAttribution,ImmutableAdmin)
admin.site.register(CommissionEntry,ImmutableAdmin)
admin.site.register(ClientRecognition,ImmutableAdmin)
