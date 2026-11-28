# domains/urls.py

from django.urls import path, include
from .tld_pricing_admin import admin_tld_price_cards, publish_tld_price_card
from .pilot import domain_pilot
from .live_registration import registration_checkout
from .live_cart import checkout as live_cart_checkout
from .launch_views import registrar_launch_review
from .combined_cart import combined_cart
from .sandbox_workspace import sandbox_domains, sandbox_dns
from rest_framework.routers import DefaultRouter
from .views import (
    DomainViewSet, DNSRecordViewSet, TLDPricingViewSet,
    DomainSearchViewSet, SSLCertificateViewSet
)

router = DefaultRouter()
router.register(r'domains', DomainViewSet, basename='domain')
router.register(r'dns-records', DNSRecordViewSet, basename='dns-record')
router.register(r'tld-pricing', TLDPricingViewSet, basename='tld-pricing')
router.register(r'search', DomainSearchViewSet, basename='domain-search')
router.register(r'ssl-certificates', SSLCertificateViewSet, basename='ssl-certificate')

urlpatterns = [
    path("live-registration/",registration_checkout,name="live-domain-registration"),
    path("live-cart/",live_cart_checkout,name="live-domain-cart"),
    path("sandbox-domains/", sandbox_domains, name="customer-sandbox-domains"),
    path("sandbox-domains/<int:item_id>/dns/", sandbox_dns, name="customer-sandbox-dns"),
    path("admin/launch-review/", registrar_launch_review, name="registrar-launch-review"),
    path("combined-cart/", combined_cart, name="combined-domain-cart"),
    path("sandbox-purchase/", domain_pilot, name="domain-sandbox-purchase"),
    path("admin/tld-price-cards/", admin_tld_price_cards, name="admin-tld-price-cards"),
    path("admin/tld-price-cards/publication/", publish_tld_price_card, name="publish-tld-price-card"),
    path('', include(router.urls)),
]
