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
        """Update domain nameservers"""
        domain = self.get_object()
        nameservers = request.data.get('nameservers', [])
        
        # Clear existing
        domain.nameservers.all().delete()
        
        # Create new
        for idx, ns in enumerate(nameservers):
            DomainNameserver.objects.create(
                domain=domain,
                hostname=ns,
                sort_order=idx
            )
        
        # Call provider API to update nameservers
        if domain.provider:
            adapter = ProviderRegistry.get_adapter(domain.provider.id)
            result = adapter.update_nameservers(domain.domain_name, nameservers)
            
            if not result.success:
                return Response({'error': result.error}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({'message': 'Nameservers updated successfully'})
    
    @action(detail=True, methods=['get'])
    def dns_records(self, request, pk=None):
        """Get DNS records"""
        domain = self.get_object()
        records = domain.dns_records.filter(is_active=True)
        serializer = DNSRecordSerializer(records, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def create_dns_record(self, request, pk=None):
        """Create DNS record"""
        domain = self.get_object()
        serializer = DNSRecordCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Create record
        record = DNSRecord.objects.create(
            domain=domain,
            record_type=serializer.validated_data['record_type'],
            name=serializer.validated_data['name'],
            value=serializer.validated_data['value'],
            ttl=serializer.validated_data['ttl'],
            priority=serializer.validated_data.get('priority')
        )
        
        # Call provider API to create record
        if domain.provider:
            adapter = ProviderRegistry.get_adapter(domain.provider.id)
            result = adapter.update_dns_record(domain.domain_name, {
                'type': record.record_type,
                'name': record.name,
                'value': record.value,
                'ttl': record.ttl,
                'priority': record.priority
            })
            
            if result.success:
                record.provider_record_id = result.data.get('record_id')
                record.save()
        
        return Response(DNSRecordSerializer(record).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def delete_dns_record(self, request, pk=None):
        """Delete DNS record"""
        domain = self.get_object()
        record_id = request.data.get('record_id')
        
        record = get_object_or_404(DNSRecord, id=record_id, domain=domain)
        
        # Call provider API to delete record
        if domain.provider and record.provider_record_id:
            adapter = ProviderRegistry.get_adapter(domain.provider.id)
            adapter.delete_dns_record(domain.domain_name, record.provider_record_id)
        
        record.delete()
        return Response({'message': 'DNS record deleted'})
    
    @action(detail=True, methods=['post'])
    def renew(self, request, pk=None):
        """Renew domain"""
        domain = self.get_object()
        years = request.data.get('years', 1)
        
        # Get TLD pricing
        tld_pricing = TLDPricing.objects.filter(tld=domain.tld, status='active').first()
        if not tld_pricing:
            return Response({'error': 'Pricing not found for TLD'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create invoice for renewal
        amount = tld_pricing.renewal_price * years
        
        invoice = Invoice.objects.create(
            client=domain.client,
            subtotal=amount,
            total=amount,
            due_date=timezone.now() + timezone.timedelta(days=7),
            metadata={'type': 'domain_renewal', 'domain_id': domain.id, 'years': years}
        )
        
        InvoiceItem.objects.create(
            invoice=invoice,
            description=f"Renewal of {domain.domain_name} for {years} year(s)",
            product_id=0,  # Domain product
            domain_name=domain.domain_name,
            quantity=years,
            unit_price=tld_pricing.renewal_price,
            subtotal=amount,
            period_start=timezone.now(),
            period_end=timezone.now() + timezone.timedelta(days=years * 365)
        )
        
        return Response({
            'message': 'Renewal invoice created',
            'invoice_id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'amount': amount
        })


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
        """Toggle DNS record active status"""
        record = self.get_object()
        record.is_active = not record.is_active
        record.save()
        
        return Response({'is_active': record.is_active})


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
        """Check domain availability"""
        serializer = DomainCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        domain_name = serializer.validated_data['domain_name']
        
        # Parse domain and TLD
        parts = domain_name.split('.')
        domain = parts[0]
        tld = '.' + '.'.join(parts[1:])
        
        # Get TLD pricing
        tld_pricing = TLDPricing.objects.filter(tld=tld, status='active').first()
        
        # Check availability (would call provider API)
        # For now, simulate
        from providers.registry import ProviderRegistry
        provider = Provider.objects.filter(adapter_type='DomainRegistrarAdapter', status='active').first()
        
        if provider:
            adapter = ProviderRegistry.get_adapter(provider.id)
            result = adapter.check_availability(domain_name)
            
            is_available = result.success and result.data.get('available', False)
            price = tld_pricing.register_price if is_available and tld_pricing else None
        else:
            # Mock response for development
            is_available = False
            price = tld_pricing.register_price if tld_pricing else None
        
        # Log search
        DomainSearchLog.objects.create(
            client=request.user if request.user.is_authenticated else None,
            session_key=request.session.session_key,
            query=domain_name,
            tld=tld,
            is_available=is_available,
            price=price,
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT')
        )
        
        return Response({
            'domain': domain_name,
            'available': is_available,
            'price': price,
            'currency': 'NGN',
            'tld_info': {
                'tld': tld,
                'register_price': tld_pricing.register_price if tld_pricing else None,
                'transfer_price': tld_pricing.transfer_price if tld_pricing else None,
                'renewal_price': tld_pricing.renewal_price if tld_pricing else None,
            } if tld_pricing else None
        })
    
    @action(detail=False, methods=['post'])
    @transaction.atomic
    def register(self, request):
        """Register a domain"""
        serializer = DomainRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        domain_name = serializer.validated_data['domain_name']
        years = serializer.validated_data['years']
        
        # Get TLD pricing
        parts = domain_name.split('.')
        tld = '.' + '.'.join(parts[1:])
        tld_pricing = TLDPricing.objects.filter(tld=tld, status='active').first()
        
        if not tld_pricing:
            return Response({'error': 'TLD not supported'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Calculate price
        amount = tld_pricing.register_price * years
        
        # Create order
        order = Order.objects.create(
            client=request.user,
            source='web',
            status='pending_payment',
            subtotal=amount,
            total=amount
        )
        
        # Create order item
        OrderItem.objects.create(
            order=order,
            product_id=0,  # Domain product ID
            plan_id=0,  # Domain plan ID
            billing_cycle_id=0,
            item_type='domain',
            description=f"Domain registration: {domain_name} for {years} year(s)",
            domain_name=domain_name,
            quantity=years,
            unit_price=tld_pricing.register_price,
            cycle_key='yearly',
            months=years * 12,
            config={
                'nameservers': serializer.validated_data.get('nameservers', []),
                'registrant_contact': serializer.validated_data.get('registrant_contact'),
                'admin_contact': serializer.validated_data.get('admin_contact'),
                'privacy_protection': serializer.validated_data.get('privacy_protection', False)
            }
        )
        
        # Create invoice
        invoice = Invoice.create_from_order(order)
        
        return Response({
            'message': 'Domain registration initiated',
            'order_id': order.id,
            'order_number': order.order_number,
            'invoice_id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'amount': amount
        })
    
    @action(detail=False, methods=['post'])
    @transaction.atomic
    def transfer(self, request):
        """Transfer a domain"""
        serializer = DomainTransferSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        domain_name = serializer.validated_data['domain_name']
        
        # Get TLD pricing
        parts = domain_name.split('.')
        tld = '.' + '.'.join(parts[1:])
        tld_pricing = TLDPricing.objects.filter(tld=tld, status='active').first()
        
        if not tld_pricing:
            return Response({'error': 'TLD not supported'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Calculate price
        amount = tld_pricing.transfer_price
        
        # Create order
        order = Order.objects.create(
            client=request.user,
            source='web',
            status='pending_payment',
            subtotal=amount,
            total=amount
        )
        
        # Create order item
        OrderItem.objects.create(
            order=order,
            product_id=0,
            plan_id=0,
            billing_cycle_id=0,
            item_type='domain',
            description=f"Domain transfer: {domain_name}",
            domain_name=domain_name,
            quantity=1,
            unit_price=tld_pricing.transfer_price,
            cycle_key='once',
            months=0,
            config={
                'epp_code': serializer.validated_data['epp_code'],
                'auth_code': serializer.validated_data.get('auth_code')
            }
        )
        
        # Create invoice
        invoice = Invoice.create_from_order(order)
        
        return Response({
            'message': 'Domain transfer initiated',
            'order_id': order.id,
            'order_number': order.order_number,
            'invoice_id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'amount': amount
        })
    
    @action(detail=False, methods=['get'])
    def suggestions(self, request):
        """Get domain suggestions"""
        keyword = request.query_params.get('keyword', '')
        
        if not keyword:
            return Response({'suggestions': []})
        
        tlds = ['.com', '.ng', '.org', '.net', '.io', '.co', '.africa']
        suggestions = []
        
        for tld in tlds:
            suggestions.append({
                'domain': f"{keyword}{tld}",
                'tld': tld,
                'available': False,
                'price': 15000  # Mock price
            })
        
        return Response({'suggestions': suggestions})


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
    @transaction.atomic
    def order(self, request):
        """Order SSL certificate"""
        serializer = SSLOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        years = serializer.validated_data['years']
        
        # Mock pricing - would get from provider
        prices = {'dv': 25000, 'ov': 45000, 'wildcard': 85000}
        amount = prices.get(serializer.validated_data['certificate_type'], 25000) * years
        
        # Create order
        order = Order.objects.create(
            client=request.user,
            source='web',
            status='pending_payment',
            subtotal=amount,
            total=amount
        )
        
        # Create order item
        OrderItem.objects.create(
            order=order,
            product_id=0,
            plan_id=0,
            billing_cycle_id=0,
            item_type='ssl',
            description=f"SSL Certificate: {serializer.validated_data['common_name']}",
            quantity=years,
            unit_price=amount / years,
            cycle_key='yearly',
            months=years * 12,
            config={
                'common_name': serializer.validated_data['common_name'],
                'san_domains': serializer.validated_data.get('san_domains', []),
                'certificate_type': serializer.validated_data['certificate_type']
            }
        )
        
        # Create invoice
        invoice = Invoice.create_from_order(order)
        
        return Response({
            'message': 'SSL certificate order created',
            'order_id': order.id,
            'order_number': order.order_number,
            'invoice_id': invoice.id,
            'amount': amount
        })

