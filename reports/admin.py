# reports/admin.py

from django.contrib import admin
from .models import ReportDefinition, ReportInstance, DashboardWidget, SavedReportFilter, Metric, MetricHistory


@admin.register(ReportDefinition)
class ReportDefinitionAdmin(admin.ModelAdmin):
    list_display = ['name', 'report_type', 'auto_generate', 'frequency', 'is_active']
    list_filter = ['report_type', 'auto_generate', 'is_active']
    search_fields = ['name', 'description']


@admin.register(ReportInstance)
class ReportInstanceAdmin(admin.ModelAdmin):
    list_display = ['definition', 'status', 'row_count', 'generated_at']
    list_filter = ['status', 'file_format']
    readonly_fields = ['generated_at', 'completed_at']


@admin.register(DashboardWidget)
class DashboardWidgetAdmin(admin.ModelAdmin):
    list_display = ['title', 'widget_type', 'size', 'is_active', 'sort_order']
    list_filter = ['widget_type', 'size', 'is_active']
    search_fields = ['title']


@admin.register(Metric)
class MetricAdmin(admin.ModelAdmin):
    list_display = ['name', 'key', 'current_value', 'change_percent', 'trend', 'last_updated']
    list_filter = ['metric_type', 'is_active']
    search_fields = ['name', 'key']