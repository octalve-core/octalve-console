# billing/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.utils import timezone
from .models import Invoice, Tax, Quote
from .serializers import InvoiceSerializer, TaxSerializer, QuoteSerializer, CreateQuoteSerializer
from rbac.decorators import permission_required


class InvoiceWriteAuthority(BasePermission):
    """Never let a customer forge invoice state, totals or payment proof."""

    def has_permission(self, request, view):
        if view.action in ("create", "update", "partial_update", "destroy"):
            user = request.user
            return bool(user and user.is_authenticated and
                        (user.is_superuser or user.role == "admin"))
        return True


class InvoiceViewSet(viewsets.ModelViewSet):
    """ViewSet for invoices"""
    
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, InvoiceWriteAuthority]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status']
    search_fields = ['invoice_number', 'client__email', 'client__full_name']
    ordering_fields = ['issue_date', 'due_date', 'total']
    ordering = ['-issue_date']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Invoice.objects.all()
        return Invoice.objects.filter(client=user)
    
    @action(detail=True, methods=['post'])
    def pay_with_wallet(self, request, pk=None):
        """No unverified wallet debit or invoice-paid shortcut.

        Legacy implementation deducted wallet funds then called invoice.mark_paid()
        without an atomic trusted transaction and recorded amount_due only after
        marking it zero. Block until the wallet ledger and settlement outbox are
        independently qualified; preventing lost money is more important than
        maintaining an unsafe convenience endpoint.
        """
        return Response(
            {'error': 'Wallet invoice payment is temporarily unavailable.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """Download invoice as PDF"""
        invoice = self.get_object()
        # This would generate PDF using a library like reportlab or weasyprint
        return Response({'message': 'PDF generation not implemented yet'})


class TaxViewSet(viewsets.ModelViewSet):
    """ViewSet for taxes (admin only)"""
    
    queryset = Tax.objects.all()
    serializer_class = TaxSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Tax.objects.all()
        return Tax.objects.filter(is_active=True)
    
    @permission_required('manage_settings')
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
    
    @permission_required('manage_settings')
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)
    
    @permission_required('manage_settings')
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)


class QuoteViewSet(viewsets.ModelViewSet):
    """ViewSet for quotes"""
    
    serializer_class = QuoteSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['quote_number', 'client__email']
    ordering = ['-issued_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Quote.objects.all()
        return Quote.objects.filter(client=user)
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Create a new quote"""
        serializer = CreateQuoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        items = serializer.validated_data['items']
        subtotal = sum(item.get('price', 0) * item.get('quantity', 1) for item in items)
        
        quote = Quote.objects.create(
            client=request.user,
            subtotal=subtotal,
            total=subtotal,
            valid_until=timezone.now() + timezone.timedelta(days=serializer.validated_data.get('valid_days', 7)),
            notes=serializer.validated_data.get('notes', ''),
            items_data=items
        )
        
        return Response(QuoteSerializer(quote).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Accept a quote and convert to order"""
        quote = self.get_object()
        
        if quote.status != 'sent':
            return Response({'error': 'Quote cannot be accepted'}, status=status.HTTP_400_BAD_REQUEST)
        
        if quote.valid_until < timezone.now():
            return Response({'error': 'Quote has expired'}, status=status.HTTP_400_BAD_REQUEST)
        
        order = quote.convert_to_order()
        
        return Response({
            'message': 'Quote accepted and converted to order',
            'order_id': order.id,
            'order_number': order.order_number
        })

