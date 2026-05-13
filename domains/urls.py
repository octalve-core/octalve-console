# domains/urls.py

from django.urls import path, include
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
    path('', include(router.urls)),
]