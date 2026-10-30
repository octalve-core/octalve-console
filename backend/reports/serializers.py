# reports/serializers.py

from rest_framework import serializers
from .models import (
    ReportDefinition, ReportInstance, DashboardWidget,
    SavedReportFilter, Metric, MetricHistory
)


class ReportDefinitionSerializer(serializers.ModelSerializer):
    """Serializer for report definitions"""
    
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    frequency_display = serializers.CharField(source='get_frequency_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = ReportDefinition
        fields = [
            'id', 'name', 'description', 'report_type', 'report_type_display',
            'config', 'columns', 'filters', 'auto_generate', 'frequency',
            'frequency_display', 'last_generated_at', 'next_generation_at',
            'notification_emails', 'default_format', 'is_active', 'is_public',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'last_generated_at', 'created_at', 'updated_at']


class ReportInstanceSerializer(serializers.ModelSerializer):
    """Serializer for report instances"""
    
    definition_name = serializers.CharField(source='definition.name', read_only=True)
    generated_by_name = serializers.CharField(source='generated_by.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = ReportInstance
        fields = [
            'id', 'definition', 'definition_name', 'generated_by', 'generated_by_name',
            'title', 'period_start', 'period_end', 'filters_used', 'status',
            'status_display', 'file_format',
            'file_size', 'row_count', 'generated_at', 'completed_at'
        ]
        # read_only_fields = '__all__'
        read_only_fields = ['id', 'created_at']


class GenerateReportSerializer(serializers.Serializer):
    """Serializer for generating a report"""
    
    definition_id = serializers.IntegerField()
    period_start = serializers.DateTimeField()
    period_end = serializers.DateTimeField()
    format = serializers.ChoiceField(choices=['csv', 'excel', 'pdf', 'json'], default='excel')
    title = serializers.CharField(required=False)
    filters = serializers.JSONField(required=False, default=dict)


class DashboardWidgetSerializer(serializers.ModelSerializer):
    """Serializer for dashboard widgets"""
    
    widget_type_display = serializers.CharField(source='get_widget_type_display', read_only=True)
    chart_type_display = serializers.CharField(source='get_chart_type_display', read_only=True)
    
    class Meta:
        model = DashboardWidget
        fields = [
            'id', 'title', 'description', 'widget_type', 'widget_type_display',
            'chart_type', 'chart_type_display', 'data_source', 'data_config',
            'size', 'color', 'icon', 'refresh_interval', 'visible_to_roles',
            'sort_order', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class SavedReportFilterSerializer(serializers.ModelSerializer):
    """Serializer for saved report filters"""
    
    class Meta:
        model = SavedReportFilter
        fields = ['id', 'name', 'report_type', 'filters', 'is_default', 'created_at']
        read_only_fields = ['id', 'created_at']


class MetricSerializer(serializers.ModelSerializer):
    """Serializer for metrics"""
    
    metric_type_display = serializers.CharField(source='get_metric_type_display', read_only=True)
    trend_display = serializers.CharField(source='get_trend_display', read_only=True)
    
    class Meta:
        model = Metric
        fields = [
            'id', 'key', 'name', 'description', 'metric_type', 'metric_type_display',
            'current_value', 'previous_value', 'change_percent', 'trend',
            'trend_display', 'last_updated', 'is_active'
        ]
        read_only_fields = ['id', 'current_value', 'previous_value', 'change_percent', 'trend', 'last_updated']


class MetricHistorySerializer(serializers.ModelSerializer):
    """Serializer for metric history"""
    
    class Meta:
        model = MetricHistory
        fields = ['id', 'value', 'recorded_at']
        # read_only_fields = '__all__'
        read_only_fields = ['id', 'created_at']


class DashboardDataSerializer(serializers.Serializer):
    """Serializer for dashboard data"""
    
    metrics = serializers.DictField()
    charts = serializers.DictField()
    recent_activities = serializers.ListField()
