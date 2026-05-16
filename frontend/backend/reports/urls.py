# reports/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ReportDefinitionViewSet, ReportInstanceViewSet, DashboardWidgetViewSet,
    SavedReportFilterViewSet, MetricViewSet, FinancialReportViewSet
)

router = DefaultRouter()
router.register(r'definitions', ReportDefinitionViewSet, basename='report-definition')
router.register(r'instances', ReportInstanceViewSet, basename='report-instance')
router.register(r'widgets', DashboardWidgetViewSet, basename='dashboard-widget')
router.register(r'filters', SavedReportFilterViewSet, basename='saved-filter')
router.register(r'metrics', MetricViewSet, basename='metric')
router.register(r'financial', FinancialReportViewSet, basename='financial-report')

urlpatterns = [
    path('', include(router.urls)),
]