# audit/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q
from django.utils import timezone
from .models import AuditLog, LoginAttempt, APIAccessLog, SecurityEvent, DataExportLog
from .serializers import (
    AuditLogSerializer, LoginAttemptSerializer, APIAccessLogSerializer,
    SecurityEventSerializer, DataExportLogSerializer, AuditStatsSerializer
)
from rbac.decorators import permission_required


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for audit logs (read-only)"""
    
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['action', 'actor_role', 'entity_type']
    search_fields = ['actor_email', 'entity_name', 'details']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return AuditLog.objects.all()
        if user.role == 'staff':
            return AuditLog.objects.filter(actor=user) | AuditLog.objects.filter(entity_id=str(user.id))
        return AuditLog.objects.filter(actor=user)
    
    @action(detail=False, methods=['get'])
    @permission_required('view_audit_logs')
    def stats(self, request):
        """Get audit log statistics"""
        queryset = self.get_queryset()
        now = timezone.now()
        
        stats = {
            'total_actions': queryset.count(),
            'by_action': {},
            'by_user': {},
            'by_date': {},
            'last_24h': queryset.filter(created_at__gte=now - timezone.timedelta(hours=24)).count(),
            'last_7d': queryset.filter(created_at__gte=now - timezone.timedelta(days=7)).count(),
            'last_30d': queryset.filter(created_at__gte=now - timezone.timedelta(days=30)).count(),
        }
        
        # By action
        action_stats = queryset.values('action').annotate(count=Count('id')).order_by('-count')[:20]
        for item in action_stats:
            stats['by_action'][item['action']] = item['count']
        
        # By user
        user_stats = queryset.values('actor_email').annotate(count=Count('id')).order_by('-count')[:20]
        for item in user_stats:
            if item['actor_email']:
                stats['by_user'][item['actor_email']] = item['count']
        
        # By date (last 30 days)
        for i in range(30):
            date = (now - timezone.timedelta(days=i)).date()
            count = queryset.filter(created_at__date=date).count()
            if count > 0:
                stats['by_date'][date.isoformat()] = count
        
        return Response(stats)
    
    @action(detail=False, methods=['get'])
    @permission_required('view_audit_logs')
    def user_activity(self, request):
        """Get activity for a specific user"""
        user_id = request.query_params.get('user_id')
        if not user_id:
            return Response({'error': 'user_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        logs = self.get_queryset().filter(actor_id=user_id)[:100]
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    @permission_required('view_audit_logs')
    def entity_activity(self, request):
        """Get activity for a specific entity"""
        entity_type = request.query_params.get('entity_type')
        entity_id = request.query_params.get('entity_id')
        
        if not entity_type or not entity_id:
            return Response({'error': 'entity_type and entity_id required'}, status=status.HTTP_400_BAD_REQUEST)
        
        logs = self.get_queryset().filter(entity_type=entity_type, entity_id=entity_id)[:100]
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)


class LoginAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for login attempts (admin only)"""
    
    serializer_class = LoginAttemptSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['was_successful']
    search_fields = ['email', 'ip_address']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return LoginAttempt.objects.all()
        return LoginAttempt.objects.filter(email=user.email)
    
    @action(detail=False, methods=['get'])
    @permission_required('view_audit_logs')
    def failed_attempts(self, request):
        """Get failed login attempts"""
        attempts = self.get_queryset().filter(was_successful=False)[:100]
        serializer = self.get_serializer(attempts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    @permission_required('view_audit_logs')
    def by_ip(self, request):
        """Get login attempts grouped by IP"""
        ip = request.query_params.get('ip')
        if not ip:
            return Response({'error': 'ip required'}, status=status.HTTP_400_BAD_REQUEST)
        
        attempts = self.get_queryset().filter(ip_address=ip)[:100]
        serializer = self.get_serializer(attempts, many=True)
        return Response(serializer.data)


class APIAccessLogViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for API access logs (admin only)"""
    
    serializer_class = APIAccessLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['method', 'status_code']
    search_fields = ['path', 'ip_address']
    ordering_fields = ['created_at', 'response_time_ms']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return APIAccessLog.objects.all()
        return APIAccessLog.objects.filter(user=user)
    
    @action(detail=False, methods=['get'])
    @permission_required('view_audit_logs')
    def slow_requests(self, request):
        """Get slow API requests (> 1 second)"""
        logs = self.get_queryset().filter(response_time_ms__gt=1000)[:100]
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    @permission_required('view_audit_logs')
    def error_requests(self, request):
        """Get API requests with errors (4xx, 5xx)"""
        logs = self.get_queryset().filter(status_code__gte=400)[:100]
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)


class SecurityEventViewSet(viewsets.ModelViewSet):
    """ViewSet for security events"""
    
    serializer_class = SecurityEventSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['event_type', 'severity', 'is_resolved']
    search_fields = ['description', 'ip_address', 'user_email']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return SecurityEvent.objects.all()
        if user.role == 'staff':
            return SecurityEvent.objects.filter(user=user) | SecurityEvent.objects.filter(is_resolved=False)
        return SecurityEvent.objects.filter(user=user)
    
    @action(detail=True, methods=['post'])
    @permission_required('manage_security')
    def resolve(self, request, pk=None):
        """Resolve a security event"""
        event = self.get_object()
        note = request.data.get('note', '')
        event.resolve(request.user, note)
        return Response({'message': 'Security event resolved'})


class DataExportLogViewSet(viewsets.ModelViewSet):
    """ViewSet for data export logs"""
    
    serializer_class = DataExportLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['export_type', 'status']
    ordering = ['-created_at']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return DataExportLog.objects.all()
        return DataExportLog.objects.filter(user=user)
    
    @action(detail=False, methods=['post'])
    def export_invoices(self, request):
        """Request invoice data export"""
        from django.core.management import call_command
        import uuid
        
        export = DataExportLog.objects.create(
            user=request.user,
            export_type='invoices',
            filters=request.data.get('filters', {}),
            expires_at=timezone.now() + timezone.timedelta(days=7),
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500]
        )
        
        # This would trigger a background task
        export.mark_completed(
            file_url=f"/exports/invoices_{uuid.uuid4().hex}.csv",
            file_size=0
        )
        
        return Response({'export_id': export.id, 'status': export.status})

