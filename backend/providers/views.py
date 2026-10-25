# providers/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.utils import timezone
from .models import Provider, ProviderPackage, ProviderLog, ProviderHealthCheck
from .serializers import (
    ProviderSerializer, ProviderPackageSerializer, ProviderLogSerializer,
    ProviderTestSerializer, ProviderHealthCheckSerializer
)
from .registry import ProviderRegistry
from rbac.decorators import permission_required
from catalog.permissions import InternalSupplierAuthority


class ProviderViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing service providers (DirectAdmin, cPanel, etc.)
    """
    
    serializer_class = ProviderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['adapter_type', 'status', 'health_status', 'test_mode']
    search_fields = ['name', 'base_url', 'username']
    ordering_fields = ['name', 'status', 'health_status', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Provider.objects.all()
        # Staff can view providers but not sensitive data
        if user.role == 'staff':
            return Provider.objects.all()
        # Clients cannot view providers
        return Provider.objects.none()
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    @permission_required('manage_providers')
    def create(self, request, *args, **kwargs):
        """Create a new provider (admin only)"""
        return super().create(request, *args, **kwargs)
    
    @permission_required('manage_providers')
    def update(self, request, *args, **kwargs):
        """Update provider (admin only)"""
        return super().update(request, *args, **kwargs)
    
    @permission_required('manage_providers')
    def partial_update(self, request, *args, **kwargs):
        """PATCH must enforce the same provider-secret authority as PUT."""
        return super().partial_update(request, *args, **kwargs)

    @permission_required('manage_providers')
    def destroy(self, request, *args, **kwargs):
        """Delete provider (admin only)"""
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'])
    @permission_required('manage_providers')
    def test_connection(self, request, pk=None):
        """
        Test connection to the provider
        """
        provider = self.get_object()
        
        try:
            adapter = ProviderRegistry.get_adapter(provider.id)
            result = adapter.test_connection()
            
            # Update provider health based on test
            if result.success:
                provider.update_health(True, result.data.get('message', 'Connection successful'))
                return Response({
                    'success': True,
                    'message': 'Connection test successful',
                    'data': result.data
                })
            else:
                provider.update_health(False, result.error)
                return Response({
                    'success': False,
                    'error': result.error
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            provider.update_health(False, str(e))
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['post'])
    @permission_required('manage_providers')
    def sync_packages(self, request, pk=None):
        """No success response until an authenticated provider sync is audited."""
        self.get_object()
        return Response(
            {'error': 'Supplier package sync is unavailable until adapter-backed sync and admin review are implemented.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    @action(detail=True, methods=['get'])
    def health(self, request, pk=None):
        """
        Get provider health status
        """
        provider = self.get_object()
        
        return Response({
            'status': provider.health_status,
            'last_check': provider.last_health_check,
            'message': provider.health_check_message,
            'is_healthy': provider.health_status == 'healthy'
        })
    
    @action(detail=False, methods=['get'])
    def health_overview(self, request):
        """
        Get health overview for all providers
        """
        providers = self.get_queryset()
        
        overview = {
            'total': providers.count(),
            'healthy': providers.filter(health_status='healthy').count(),
            'degraded': providers.filter(health_status='degraded').count(),
            'unhealthy': providers.filter(health_status='unhealthy').count(),
            'unknown': providers.filter(health_status='unknown').count(),
            'providers': []
        }
        
        for provider in providers:
            overview['providers'].append({
                'id': provider.id,
                'name': provider.name,
                'adapter_type': provider.adapter_type,
                'status': provider.status,
                'health_status': provider.health_status,
                'last_health_check': provider.last_health_check
            })
        
        return Response(overview)
    
    @action(detail=True, methods=['post'])
    @permission_required('manage_providers')
    def provision_test(self, request, pk=None):
        """Do not create/deallocate live provider accounts in an HTTP test."""
        self.get_object()
        return Response(
            {'error': 'Provider provisioning tests require an isolated, audited worker.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class ProviderPackageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for provider packages
    """
    
    serializer_class = ProviderPackageSerializer
    permission_classes = [InternalSupplierAuthority]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['provider', 'is_active']
    search_fields = ['name', 'provider_package_id']
    
    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'staff'] or user.is_superuser:
            return ProviderPackage.objects.all()
        return ProviderPackage.objects.none()
    
    @action(detail=False, methods=['get'])
    def by_provider(self, request):
        """
        Get packages for a specific provider
        """
        provider_id = request.query_params.get('provider_id')
        if not provider_id:
            return Response({'error': 'provider_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        packages = self.get_queryset().filter(provider_id=provider_id, is_active=True)
        serializer = self.get_serializer(packages, many=True)
        return Response(serializer.data)


class ProviderLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for provider logs (read-only)
    """
    
    serializer_class = ProviderLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['provider', 'action', 'method', 'success', 'status_code']
    search_fields = ['action', 'endpoint', 'error_message']
    ordering_fields = ['-created_at', 'duration_ms']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'staff'] or user.is_superuser:
            return ProviderLog.objects.all()
        return ProviderLog.objects.none()
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    @action(detail=False, methods=['get'])
    def errors(self, request):
        """
        Get recent error logs
        """
        limit = int(request.query_params.get('limit', 50))
        logs = self.get_queryset().filter(success=False)[:limit]
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Get log statistics
        """
        from django.db.models import Count, Avg
        
        stats = {
            'total_requests': ProviderLog.objects.count(),
            'successful': ProviderLog.objects.filter(success=True).count(),
            'failed': ProviderLog.objects.filter(success=False).count(),
            'avg_response_time': ProviderLog.objects.aggregate(Avg('duration_ms'))['duration_ms__avg'],
            'by_provider': [],
            'by_action': []
        }
        
        # Stats by provider
        provider_stats = ProviderLog.objects.values('provider__name').annotate(
            count=Count('id'),
            avg_time=Avg('duration_ms')
        )
        stats['by_provider'] = list(provider_stats)
        
        # Stats by action
        action_stats = ProviderLog.objects.values('action').annotate(
            count=Count('id'),
            success_rate=(
                Count('id', filter=models.Q(success=True)) * 100.0 / Count('id')
            )
        )
        stats['by_action'] = list(action_stats)
        
        return Response(stats)
