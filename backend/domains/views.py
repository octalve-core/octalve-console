# domains/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import (
    Domain, DomainNameserver, DNSRecord, TLDPricing,
    DomainSearchLog, SSLCertificate
)
from .serializers import (
    DomainSerializer, DomainNameserverSerializer, DNSRecordSerializer,
    TLDPricingSerializer, DomainSearchSerializer, DomainCheckSerializer,
    DomainRegisterSerializer, DomainTransferSerializer,
    DNSRecordCreateSerializer, SSLCertificateSerializer, SSLOrderSerializer
)
from billing.models import Invoice, InvoiceItem
from orders.models import Order, OrderItem
from providers.registry import ProviderRegistry
from rbac.decorators import permission_required
import re


def _requires_approved_provider(operation):
    """Fail closed: neither draft offers nor internal records prove an external action."""
    return Response(
        {'error': f'{operation} unavailable until approved provider authority and confirmed execution are implemented.'},
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


class DomainViewSet(viewsets.ModelViewSet):
    """ViewSet for domains"""
    
    serializer_class = DomainSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'tld', 'auto_renew']
    search_fields = ['domain_name']
    ordering_fields = ['domain_name', 'expiry_date', 'registration_date']
    ordering = ['domain_name']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Domain.objects.all()
        return Domain.objects.filter(client=user)
    
    @action(detail=True, methods=['get'])
    def nameservers(self, request, pk=None):
        """Get domain nameservers"""
        domain = self.get_object()
        nameservers = domain.nameservers.all()
        serializer = DomainNameserverSerializer(nameservers, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def update_nameservers(self, request, pk=None):
        self.get_object()  # Enforce ownership; do not write local nameservers first.
        return _requires_approved_provider('Nameserver change')

    @action(detail=True, methods=['get'])
    def dns_records(self, request, pk=None):
        """Get DNS records"""
        domain = self.get_object()
        records = domain.dns_records.filter(is_active=True)
        serializer = DNSRecordSerializer(records, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def create_dns_record(self, request, pk=None):
        self.get_object()
        return _requires_approved_provider('DNS record creation')

    @action(detail=True, methods=['post'])
    def delete_dns_record(self, request, pk=None):
        self.get_object()
        return _requires_approved_provider('DNS record deletion')

    @action(detail=True, methods=['post'])
    def renew(self, request, pk=None):
        self.get_object()
        return _requires_approved_provider('Domain renewal')

    def create(self, request, *args, **kwargs):
        return _requires_approved_provider('Domain record creation')

    def update(self, request, *args, **kwargs):
        self.get_object()
        return _requires_approved_provider('Domain record update')

    def partial_update(self, request, *args, **kwargs):
        self.get_object()
        return _requires_approved_provider('Domain record update')

    def destroy(self, request, *args, **kwargs):
        self.get_object()
        return _requires_approved_provider('Domain record deletion')


class DNSRecordViewSet(viewsets.ModelViewSet):
    """ViewSet for DNS records"""
    
    serializer_class = DNSRecordSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return DNSRecord.objects.all()
        return DNSRecord.objects.filter(domain__client=user)
    
    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        self.get_object()
        return _requires_approved_provider('DNS state change')

    def create(self, request, *args, **kwargs):
        return _requires_approved_provider('DNS record creation')

    def update(self, request, *args, **kwargs):
        self.get_object()
        return _requires_approved_provider('DNS record update')

    def partial_update(self, request, *args, **kwargs):
        self.get_object()
        return _requires_approved_provider('DNS record update')

    def destroy(self, request, *args, **kwargs):
        self.get_object()
        return _requires_approved_provider('DNS record deletion')


class TLDPricingViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for TLD pricing"""
    
    queryset = TLDPricing.objects.filter(status='active')
    serializer_class = TLDPricingSerializer
    permission_classes = [AllowAny]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['tld']
    ordering = ['sort_order', 'tld']


class DomainSearchViewSet(viewsets.GenericViewSet):
    """ViewSet for domain search"""
    
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['post'])
    def check(self, request):
        """Never fabricate registrar availability or imply an unchecked offer."""
        serializer = DomainCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return _requires_approved_provider('Live registrar availability and pricing')

    @action(detail=False, methods=['post'])
    def register(self, request):
        """Registration requires an approved quote and verified settlement."""
        return _requires_approved_provider('Domain registration')

    @action(detail=False, methods=['post'])
    def transfer(self, request):
        """Do not collect or persist EPP codes until transfer integration exists."""
        return _requires_approved_provider('Domain transfer')

    @action(detail=False, methods=['get'])
    def suggestions(self, request):
        """No hard-coded TLDs, unverified availability or guessed prices."""
        return _requires_approved_provider('Registrar-backed domain suggestions')


class SSLCertificateViewSet(viewsets.ModelViewSet):
    """ViewSet for SSL certificates"""
    
    serializer_class = SSLCertificateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['status', 'certificate_type']
    search_fields = ['common_name']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return SSLCertificate.objects.all()
        return SSLCertificate.objects.filter(client=user)
    
    @action(detail=False, methods=['post'])
    def order(self, request):
        """An SSL order needs a priced provider offer and certificate workflow."""
        return _requires_approved_provider('SSL certificate ordering')

    def create(self, request, *args, **kwargs):
        return _requires_approved_provider('SSL certificate record creation')

    def update(self, request, *args, **kwargs):
        self.get_object()
        return _requires_approved_provider('SSL certificate record update')

    def partial_update(self, request, *args, **kwargs):
        self.get_object()
        return _requires_approved_provider('SSL certificate record update')

    def destroy(self, request, *args, **kwargs):
        self.get_object()
        return _requires_approved_provider('SSL certificate record deletion')
