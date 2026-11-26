# orders/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, CouponViewSet, CartViewSet

from .shopping_cart import account_shopping, claim_grant, claim_guest, guest_shopping

router = DefaultRouter()
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'coupons', CouponViewSet, basename='coupon')
router.register(r'cart', CartViewSet, basename='cart')

urlpatterns = [
    path("shopping/guest/", guest_shopping, name="guest-shopping"),
    path("shopping/grant/", claim_grant, name="shopping-grant"),
    path("shopping/claim/", claim_guest, name="claim-shopping"),
    path("shopping/account/", account_shopping, name="account-shopping"),
    path('', include(router.urls)),
]