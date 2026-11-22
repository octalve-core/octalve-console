# domains/urls.py

from django.urls import path, include
from .tld_pricing_admin import admin_tld_price_cards, publish_tld_price_card
from .pilot import domain_pilot
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
    path("sandbox-purchase/", domain_pilot, name="domain-sandbox-purchase"),
    path("admin/tld-price-cards/", admin_tld_price_cards, name="admin-tld-price-cards"),
    path("admin/tld-price-cards/publication/", publish_tld_price_card, name="publish-tld-price-card"),
    path('', include(router.urls)),
]
