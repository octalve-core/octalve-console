# reports/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Count, Q
from django.utils import timezone
from django.core.files.base import ContentFile
from .models import (
    ReportDefinition, ReportInstance, DashboardWidget,
    SavedReportFilter, Metric, MetricHistory
)
from .serializers import (
    ReportDefinitionSerializer, ReportInstanceSerializer, GenerateReportSerializer,
    DashboardWidgetSerializer, SavedReportFilterSerializer,
    MetricSerializer, MetricHistorySerializer
)
from .report_generators import ReportGenerator
from rbac.decorators import permission_required
import json


class ReportDefinitionViewSet(viewsets.ModelViewSet):
    """ViewSet for report definitions"""
    
    serializer_class = ReportDefinitionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['report_type', 'is_active']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return ReportDefinition.objects.all()
        if user.role == 'staff':
            return ReportDefinition.objects.filter(is_public=True)
        return ReportDefinition.objects.none()
    
    @permission_required('view_reports')
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)
    
    @permission_required('manage_reports')
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'])
    def generate(self, request, pk=None):
        """Generate a report from definition"""
        definition = self.get_object()
        
        serializer = GenerateReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Create report instance
        report = ReportInstance.objects.create(
            definition=definition,
            generated_by=request.user,
            title=serializer.validated_data.get('title', f"{definition.name} Report"),
            period_start=serializer.validated_data['period_start'],
            period_end=serializer.validated_data['period_end'],
            filters_used=serializer.validated_data.get('filters', {}),
            file_format=serializer.validated_data['format']
        )
        
        # Generate report
        generator = ReportGenerator(report)
        
        try:
            file_path, row_count = generator.generate()
            file_url = f"/media/{file_path}"
            file_size = default_storage.size(file_path)
            
            report.mark_completed(file_url, file_size, row_count)
            
            return Response({
                'id': report.id,
                'download_url': file_url,
                'row_count': row_count
            })
            
        except Exception as e:
            report.mark_failed(str(e))
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ReportInstanceViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for report instances"""
    
    serializer_class = ReportInstanceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status']
    ordering = ['-generated_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return ReportInstance.objects.all()
        if user.role == 'staff':
            return ReportInstance.objects.filter(generated_by=user)
        return ReportInstance.objects.filter(generated_by=user)
    
    @action(detail=True, methods=['delete'])
    def delete(self, request, pk=None):
        """Delete a report instance"""
        report = self.get_object()
        
        if report.file_url:
            file_path = report.file_url.replace('/media/', '')
            default_storage.delete(file_path)
        
        report.delete()
        return Response({'message': 'Report deleted'})


class DashboardWidgetViewSet(viewsets.ModelViewSet):
    """ViewSet for dashboard widgets"""
    
    serializer_class = DashboardWidgetSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        qs = DashboardWidget.objects.filter(is_active=True)
        
        # Filter by user role visibility
        visible = []
        for widget in qs:
            if not widget.visible_to_roles or user.role in widget.visible_to_roles or user.role == 'admin':
                visible.append(widget.id)
        
        return qs.filter(id__in=visible)
    
    @action(detail=False, methods=['get'])
    def dashboard_data(self, request):
        """Get data for dashboard widgets"""
        widgets = self.get_queryset()
        
        data = {
            'widgets': DashboardWidgetSerializer(widgets, many=True).data,
            'metrics': self.get_metrics_data(),
            'recent_activities': self.get_recent_activities()
        }
        
        return Response(data)
    
    def get_metrics_data(self):
        """Get current metrics data"""
        from audit.models import AuditLog
        from orders.models import Order
        from billing.models import Invoice
        from services.models import Service
        from support.models import SupportTicket
        
        now = timezone.now()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        return {
            'total_revenue': Invoice.objects.filter(status='paid', paid_at__gte=this_month).aggregate(Sum('total'))['total__sum'] or 0,
            'total_orders': Order.objects.filter(created_at__gte=this_month).count(),
            'active_services': Service.objects.filter(status='active').count(),
            'new_customers': Order.objects.values('client').distinct().count(),
            'pending_tickets': SupportTicket.objects.filter(status__in=['open', 'in_progress']).count(),
            'today_revenue': Invoice.objects.filter(status='paid', paid_at__gte=today).aggregate(Sum('total'))['total__sum'] or 0,
        }
    
    def get_recent_activities(self):
        """Get recent activities"""
        from audit.models import AuditLog
        return list(AuditLog.objects.all()[:10].values('action', 'actor_email', 'created_at'))


class SavedReportFilterViewSet(viewsets.ModelViewSet):
    """ViewSet for saved report filters"""
    
    serializer_class = SavedReportFilterSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return SavedReportFilter.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def set_default(self, request):
        """Set a filter as default for report type"""
        filter_id = request.data.get('filter_id')
        report_type = request.data.get('report_type')
        
        # Clear existing default
        SavedReportFilter.objects.filter(
            user=request.user,
            report_type=report_type,
            is_default=True
        ).update(is_default=False)
        
        # Set new default
        filter = self.get_queryset().get(id=filter_id)
        filter.is_default = True
        filter.save()
        
        return Response({'message': 'Default filter set'})


class MetricViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for business metrics"""
    
    serializer_class = MetricSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Metric.objects.filter(is_active=True)
        return Metric.objects.filter(is_active=True)[:10]
    
    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Get metric history"""
        metric = self.get_object()
        history = metric.history.all()[:30]
        serializer = MetricHistorySerializer(history, many=True)
        return Response(serializer.data)


class FinancialReportViewSet(viewsets.GenericViewSet):
    """ViewSet for financial reports"""
    
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def revenue_summary(self, request):
        """Get revenue summary by period"""
        from billing.models import Invoice
        
        period = request.query_params.get('period', 'month')
        now = timezone.now()
        
        if period == 'day':
            start = now - timezone.timedelta(days=30)
            group_by = 'date'
        elif period == 'month':
            start = now - timezone.timedelta(days=365)
            group_by = 'month'
        else:
            start = now - timezone.timedelta(days=365)
            group_by = 'month'
        
        invoices = Invoice.objects.filter(
            status='paid',
            paid_at__gte=start
        )
        
        total = invoices.aggregate(Sum('total'))['total__sum'] or 0
        count = invoices.count()
        avg = total / count if count > 0 else 0
        
        return Response({
            'total_revenue': total,
            'invoice_count': count,
            'average_invoice': avg,
            'period': period
        })
    
    @action(detail=False, methods=['get'])
    def revenue_by_gateway(self, request):
        """Get revenue broken down by payment gateway"""
        from payments.models import Transaction
        
        now = timezone.now()
        start = now - timezone.timedelta(days=30)
        
        transactions = Transaction.objects.filter(
            status='successful',
            paid_at__gte=start
        ).values('gateway__name').annotate(
            total=Sum('amount'),
            count=Count('id')
        )
        
        return Response(list(transactions))
    
    @action(detail=False, methods=['get'])
    def revenue_by_product(self, request):
        """Get revenue broken down by product"""
        from billing.models import InvoiceItem
        
        now = timezone.now()
        start = now - timezone.timedelta(days=30)
        
        items = InvoiceItem.objects.filter(
            invoice__status='paid',
            invoice__paid_at__gte=start
        ).values('description').annotate(
            total=Sum('subtotal'),
            count=Count('id')
        )[:20]
        
        return Response(list(items))
