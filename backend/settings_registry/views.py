# settings_registry/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, BasePermission
from django.shortcuts import get_object_or_404
from django.core.cache import cache
from django.core.mail import send_mail
from django.conf import settings
from .models import SettingGroup, Setting, SettingChangeLog, EmailTemplate, BrandingSettings, TaxSettings, SystemConfig
from .serializers import (
    SettingGroupSerializer, SettingSerializer, SettingUpdateSerializer,
    SettingChangeLogSerializer, EmailTemplateSerializer, EmailTestSerializer,
    BrandingSettingsSerializer, TaxSettingsSerializer, SystemConfigSerializer
)
from rbac.decorators import permission_required
import hashlib
import time


class SettingGroupViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for setting groups"""
    
    queryset = SettingGroup.objects.filter(is_active=True)
    serializer_class = SettingGroupSerializer
    permission_classes = [IsAuthenticated]
    ordering = ['sort_order']


class SettingViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for settings"""
    
    serializer_class = SettingSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['group', 'is_public', 'data_type']
    search_fields = ['key', 'name', 'description']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return Setting.objects.all()
        return Setting.objects.filter(is_public=True, is_deprecated=False, is_encrypted=False).exclude(data_type='password')
    
    # @action(detail=False, methods=['get'])
    def by_group(self, request):
        """Get settings by group key"""
        group_key = request.query_params.get('group')
        if not group_key:
            return Response({'error': 'group parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        
        group = get_object_or_404(SettingGroup, key=group_key)
        settings = self.get_queryset().filter(group=group, is_deprecated=False)
        serializer = self.get_serializer(settings, many=True)
        return Response(serializer.data)
    
    # @action(detail=False, methods=['post'])
    @permission_required('manage_settings')
    def batch_update(self, request):
        """Update multiple settings at once"""
        serializer = SettingUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        updated = []
        errors = []
        
        for key, value in serializer.validated_data['settings'].items():
            try:
                setting = Setting.objects.get(key=key)
                old_value = setting.get_value()
                
                # Log change
                SettingChangeLog.objects.create(
                    setting=setting,
                    changed_by=request.user,
                    # Audit the actor and setting identity, never the value.
                    old_value=None,
                    new_value=None,
                    ip_address=request.META.get('REMOTE_ADDR')
                )
                
                # Update setting
                setting.set_value(value)
                updated.append({'key': key, 'value': value})
                
                # Clear cache
                cache_key = f'setting_{key}'
                cache.delete(cache_key)
                cache_key = f'setting_group_{setting.group.key}'
                cache.delete(cache_key)
                
            except Setting.DoesNotExist:
                errors.append({'key': key, 'error': 'Setting not found'})
        
        return Response({
            'updated': updated,
            'errors': errors,
            'message': f'Updated {len(updated)} settings'
        })
    
    # @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Get change history for a setting"""
        setting = self.get_object()
        logs = setting.change_logs.all()[:50]
        serializer = SettingChangeLogSerializer(logs, many=True)
        return Response(serializer.data)
    
    # @action(detail=False, methods=['post'])
    @permission_required('manage_settings')
    def reset_defaults(self, request):
        """Reset settings to defaults for a group"""
        group_key = request.data.get('group_key')
        if not group_key:
            return Response({'error': 'group_key required'}, status=status.HTTP_400_BAD_REQUEST)
        
        group = get_object_or_404(SettingGroup, key=group_key)
        settings = Setting.objects.filter(group=group)
        
        reset_count = 0
        for setting in settings:
            if setting.default_value:
                setting.set_value(setting.default_value)
                reset_count += 1
        
        return Response({'message': f'Reset {reset_count} settings for group {group_key}'})


class CloudEmailTemplateAdminAccess(BasePermission):
    """Message templates are operational records, not public configuration."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and
                    (user.is_superuser or getattr(user, 'role', None) == 'admin'))


class EmailTemplateViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for email templates"""
    
    queryset = EmailTemplate.objects.all()
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsAuthenticated, CloudEmailTemplateAdminAccess]
    filterset_fields = ['category', 'is_active']
    search_fields = ['key', 'name', 'subject']
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin' or user.is_superuser:
            return EmailTemplate.objects.all()
        return EmailTemplate.objects.filter(is_active=True)
    
    # @action(detail=False, methods=['post'])
    @permission_required('manage_settings')
    def test(self, request):
        """Test email template sending"""
        serializer = EmailTestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        template = get_object_or_404(EmailTemplate, id=serializer.validated_data['template_id'])
        variables = serializer.validated_data.get('variables', {})
        
        # Add default variables
        variables.update({
            'company_name': 'Octalve',
            'company_email': settings.DEFAULT_FROM_EMAIL,
            'support_email': 'support@octalve.com',
            'year': timezone.now().year
        })
        
        subject = template.render_subject(variables)
        html_body = template.render_html(variables)
        text_body = template.render_text(variables)
        
        try:
            send_mail(
                subject=subject,
                message=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[serializer.validated_data['recipient']],
                html_message=html_body,
                fail_silently=False
            )
            return Response({'message': 'Test email sent successfully'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BrandingSettingsViewSet(viewsets.GenericViewSet):
    """ViewSet for branding settings"""
    
    serializer_class = BrandingSettingsSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        obj, created = BrandingSettings.objects.get_or_create(id=1)
        return obj
    
    # @action(detail=False, methods=['get'])
    def get(self, request):
        """Get branding settings"""
        obj = self.get_object()
        serializer = self.get_serializer(obj)
        return Response(serializer.data)
    
    # @action(detail=False, methods=['post', 'put'])
    @permission_required('manage_settings')
    def update(self, request):
        """Update branding settings"""
        obj = self.get_object()
        serializer = self.get_serializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class TaxSettingsViewSet(viewsets.GenericViewSet):
    """ViewSet for tax settings"""
    
    serializer_class = TaxSettingsSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        obj, created = TaxSettings.objects.get_or_create(id=1)
        return obj
    
    # @action(detail=False, methods=['get'])
    def get(self, request):
        """Get tax settings"""
        obj = self.get_object()
        serializer = self.get_serializer(obj)
        return Response(serializer.data)
    
    # @action(detail=False, methods=['post', 'put'])
    @permission_required('manage_settings')
    def update(self, request):
        """Update tax settings"""
        obj = self.get_object()
        serializer = self.get_serializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SystemConfigViewSet(viewsets.GenericViewSet):
    """ViewSet for system configuration"""
    
    serializer_class = SystemConfigSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        obj, created = SystemConfig.objects.get_or_create(id=1)
        return obj
    
    # @action(detail=False, methods=['get'])
    def get(self, request):
        """Get system configuration"""
        obj = self.get_object()
        serializer = self.get_serializer(obj)
        return Response(serializer.data)
    
    # @action(detail=False, methods=['post', 'put'])
    @permission_required('manage_settings')
    def update(self, request):
        """Update system configuration"""
        obj = self.get_object()
        serializer = self.get_serializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    
    # @action(detail=False, methods=['get'])
    def health(self, request):
        """Get system health status"""
        config = self.get_object()
        
        # Run health checks
        checks = {}
        overall_status = 'healthy'
        
        # Database check
        try:
            from django.db import connection
            connection.ensure_connection()
            checks['database'] = {'status': 'healthy', 'message': 'Connected'}
        except Exception as e:
            checks['database'] = {'status': 'unhealthy', 'message': str(e)}
            overall_status = 'unhealthy'
        
        # Cache check
        try:
            test_key = f'health_check_{int(time.time())}'
            cache.set(test_key, 'ok', 10)
            if cache.get(test_key) == 'ok':
                checks['cache'] = {'status': 'healthy', 'message': 'Working'}
            else:
                checks['cache'] = {'status': 'degraded', 'message': 'Cache read failed'}
        except Exception as e:
            checks['cache'] = {'status': 'unhealthy', 'message': str(e)}
            overall_status = 'unhealthy'
        
        # Queue check (Redis)
        try:
            import redis
            r = redis.Redis.from_url(settings.CELERY_BROKER_URL)
            r.ping()
            checks['queue'] = {'status': 'healthy', 'message': 'Connected'}
        except Exception as e:
            checks['queue'] = {'status': 'degraded', 'message': str(e)}
        
        # Maintenance mode
        if config.maintenance_mode:
            overall_status = 'degraded'
            checks['maintenance'] = {'status': 'warning', 'message': 'Maintenance mode enabled'}
        
        return Response({
            'status': overall_status,
            'checks': checks,
            'timestamp': timezone.now()
        })
