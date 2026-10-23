# provisioning/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import (
    ProvisioningTask, ProvisioningQueue, ProvisioningLog,
    ProvisioningWebhook, WebhookDelivery
)
from .serializers import (
    ProvisioningTaskSerializer, CreateProvisioningTaskSerializer,
    RetryTaskSerializer, ProvisioningQueueSerializer,
    ProvisioningWebhookSerializer, WebhookDeliverySerializer, QueueStatsSerializer
)
from providers.registry import ProviderRegistry
from services.models import Service
from rbac.decorators import permission_required


class ProvisioningTaskViewSet(viewsets.ModelViewSet):
    """ViewSet for provisioning tasks"""
    
    serializer_class = ProvisioningTaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'action', 'priority']
    search_fields = ['service__label', 'service__client__email', 'last_error']
    ordering_fields = ['created_at', 'scheduled_at', 'priority']
    ordering = ['-priority', 'scheduled_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return ProvisioningTask.objects.all()
        if user.role == 'staff':
            return ProvisioningTask.objects.all()
        return ProvisioningTask.objects.filter(service__client=user)
    
    @permission_required('manage_provisioning')
    def create(self, request, *args, **kwargs):
        """Create a new provisioning task"""
        serializer = CreateProvisioningTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        service = get_object_or_404(Service, id=serializer.validated_data['service_id'])
        
        # Check permissions
        if request.user.role not in ['admin', 'staff'] and not request.user.is_superuser:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get provider
        provider = service.provider_id and get_object_or_404(Provider, id=service.provider_id)
        
        # Create task
        task = ProvisioningTask.objects.create(
            service=service,
            action=serializer.validated_data['action'],
            adapter_type=provider.adapter_type if provider else '',
            provider=provider,
            priority=serializer.validated_data.get('priority', 3),
            payload=serializer.validated_data.get('payload', {}),
            scheduled_at=serializer.validated_data.get('scheduled_at', timezone.now())
        )
        
        return Response(ProvisioningTaskSerializer(task).data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    @permission_required('manage_provisioning')
    def retry(self, request, pk=None):
        """Retry a failed task"""
        task = self.get_object()
        serializer = RetryTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        if task.status not in ['failed', 'retrying']:
            return Response({'error': 'Only failed tasks can be retried'}, status=status.HTTP_400_BAD_REQUEST)
        
        if serializer.validated_data.get('reset_attempts'):
            task.attempt_count = 0
        
        task.status = 'queued'
        task.scheduled_at = timezone.now()
        task.save()
        
        return Response({'message': 'Task queued for retry'})
    
    @action(detail=True, methods=['post'])
    @permission_required('manage_provisioning')
    def cancel(self, request, pk=None):
        """Cancel a queued task"""
        task = self.get_object()
        
        if task.status not in ['queued', 'retrying']:
            return Response({'error': 'Only queued tasks can be cancelled'}, status=status.HTTP_400_BAD_REQUEST)
        
        task.mark_cancelled()
        return Response({'message': 'Task cancelled'})
    
    @action(detail=True, methods=['post'])
    @permission_required('manage_provisioning')
    def mark_needs_review(self, request, pk=None):
        """Mark task as needing review"""
        task = self.get_object()
        reason = request.data.get('reason', '')
        
        task.mark_needs_review(reason)
        return Response({'message': 'Task marked for review'})
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get task statistics"""
        queryset = self.get_queryset()
        
        stats = {
            'queued': queryset.filter(status='queued').count(),
            'running': queryset.filter(status='running').count(),
            'completed': queryset.filter(status='completed').count(),
            'failed': queryset.filter(status='failed').count(),
            'retrying': queryset.filter(status='retrying').count(),
            'needs_review': queryset.filter(status='needs_review').count(),
            'total': queryset.count(),
        }
        
        # Failed by action
        failed_by_action = queryset.filter(status='failed').values('action').annotate(count=Count('id'))
        stats['failed_by_action'] = list(failed_by_action)
        
        # Avg duration
        completed_tasks = queryset.filter(status='completed', started_at__isnull=False, completed_at__isnull=False)
        if completed_tasks.exists():
            total_duration = 0
            for task in completed_tasks:
                duration = (task.completed_at - task.started_at).total_seconds()
                total_duration += duration
            stats['avg_duration_seconds'] = total_duration / completed_tasks.count()
        
        return Response(stats)
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending tasks (for workers)"""
        if request.user.role not in ['admin', 'staff'] and not request.user.is_superuser:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        tasks = ProvisioningTask.objects.filter(
            status__in=['queued', 'retrying'],
            scheduled_at__lte=timezone.now()
        ).order_by('priority', 'scheduled_at')[:50]
        
        serializer = self.get_serializer(tasks, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    @permission_required('manage_provisioning')
    def process_next(self, request):
        """Process next task from queue (for workers)"""
        # Get next task
        task = ProvisioningTask.objects.filter(
            status__in=['queued', 'retrying'],
            scheduled_at__lte=timezone.now()
        ).order_by('priority', 'scheduled_at').first()
        
        if not task:
            return Response({'message': 'No pending tasks'})
        
        # Process task
        result = self._process_task(task, request.data.get('worker_id', 'manual'))
        
        return Response(result)
    
    def _process_task(self, task, worker_id):
        """Process a provisioning task"""
        try:
            task.mark_running(executed_by=worker_id)
            
            # Get adapter
            adapter = ProviderRegistry.get_adapter(task.provider.id)
            
            # Prepare service data
            service_data = {
                'username': task.service.metadata.get('username', task.service.label[:8]),
                'password': task.payload.get('password'),
                'domain': task.service.domain_name,
                'package': task.service.provider_package_id,
                'email': task.service.client.email,
                'name': task.service.client.full_name,
            }
            
            # Execute based on action
            if task.action == 'provision':
                result = adapter.provision(service_data)
                if result.success:
                    # Store provider identifier
                    task.service.provider_identifier = result.data.get('username')
                    task.service.save()
                    task.mark_completed(result.data)
                else:
                    task.mark_failed(result.error)
                    
            elif task.action == 'suspend':
                result = adapter.suspend(task.service.provider_identifier)
                if result.success:
                    task.mark_completed()
                else:
                    task.mark_failed(result.error)
                    
            elif task.action == 'unsuspend':
                result = adapter.unsuspend(task.service.provider_identifier)
                if result.success:
                    task.mark_completed()
                else:
                    task.mark_failed(result.error)
                    
            elif task.action == 'terminate':
                result = adapter.terminate(task.service.provider_identifier)
                if result.success:
                    task.mark_completed()
                else:
                    task.mark_failed(result.error)
                    
            elif task.action == 'sync_usage':
                result = adapter.fetch_usage(task.service.provider_identifier)
                if result.success:
                    task.mark_completed(result.data)
                else:
                    task.mark_failed(result.error)
            
            return {'success': task.status == 'completed',
                    'task_id': task.id, 'status': task.status,
                    'message': 'Task completed' if task.status == 'completed' else 'Task not completed'}
            
        except Exception as e:
            task.mark_failed(str(e))
            return {'success': False, 'task_id': task.id, 'error': str(e)}


class ProvisioningQueueViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for provisioning queues"""
    
    queryset = ProvisioningQueue.objects.all()
    serializer_class = ProvisioningQueueSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return ProvisioningQueue.objects.all()
        return ProvisioningQueue.objects.filter(is_active=True)
    
    @action(detail=False, methods=['get'])
    def metrics(self, request):
        """Get queue metrics"""
        tasks = ProvisioningTask.objects
        
        metrics = {
            'queued': tasks.filter(status='queued').count(),
            'running': tasks.filter(status='running').count(),
            'failed_last_hour': tasks.filter(
                status='failed',
                completed_at__gte=timezone.now() - timezone.timedelta(hours=1)
            ).count(),
            'avg_wait_time': 0,
        }
        
        # Calculate average wait time for completed tasks
        completed = tasks.filter(status='completed', created_at__isnull=False, started_at__isnull=False)
        if completed.exists():
            total_wait = 0
            for task in completed:
                wait = (task.started_at - task.created_at).total_seconds()
                total_wait += wait
            metrics['avg_wait_time'] = total_wait / completed.count()
        
        return Response(metrics)


class ProvisioningWebhookAccess(IsAuthenticated):
    """No customer may configure an outbound webhook or inspect its secret."""
    def has_permission(self, request, view):
        from rbac.utils import has_permission
        user = request.user
        return bool(super().has_permission(request, view) and (
            user.is_superuser or (
                user.role in ('admin', 'staff') and has_permission(user, 'manage_provisioning')
            )
        ))


class ProvisioningWebhookViewSet(viewsets.ModelViewSet):
    """ViewSet for provisioning webhooks"""
    
    queryset = ProvisioningWebhook.objects.all()
    serializer_class = ProvisioningWebhookSerializer
    permission_classes = [ProvisioningWebhookAccess]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return ProvisioningWebhook.objects.all()
        return ProvisioningWebhook.objects.filter(is_active=True)
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        # Deliberately disable arbitrary network requests from stored URLs.
        # Restore only behind an audited endpoint allowlist, DNS/IP rebinding
        # protection, redirect restrictions and a separate egress broker.
        return Response(
            {'error': 'Webhook test disabled until SSRF-safe egress is configured'},
            status=status.HTTP_501_NOT_IMPLEMENTED,
        )
