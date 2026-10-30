# settings_registry/urls.py

from django.urls import path, include
from .console_views import ConsolePolicyView
from .tax_policy import ConsoleTaxPolicyView
from .public_theme import ConsoleThemeView
from .mail_views import TemplateListView,TemplateDetailView,TemplateDuplicateView,TemplatePreviewView,OutboxDashboardView
from rest_framework.routers import DefaultRouter
from .views import (
    SettingGroupViewSet, SettingViewSet, EmailTemplateViewSet,
    BrandingSettingsViewSet, TaxSettingsViewSet, SystemConfigViewSet
)

router = DefaultRouter()
router.register(r'groups', SettingGroupViewSet, basename='setting-group')
router.register(r'settings', SettingViewSet, basename='setting')
router.register(r'email-templates', EmailTemplateViewSet, basename='email-template')
router.register(r'branding', BrandingSettingsViewSet, basename='branding')
router.register(r'tax', TaxSettingsViewSet, basename='tax-settings')
router.register(r'system', SystemConfigViewSet, basename='system-config')

urlpatterns = [
    path('console-theme/',ConsoleThemeView.as_view(),name='console-theme'),
    path('console-tax/',ConsoleTaxPolicyView.as_view(),name='console-tax'),
    path('console-mail/templates/',TemplateListView.as_view(),name='console-mail-templates'),
    path('console-mail/templates/<int:pk>/',TemplateDetailView.as_view(),name='console-mail-template-detail'),
    path('console-mail/templates/<int:pk>/duplicate/',TemplateDuplicateView.as_view(),name='console-mail-template-duplicate'),
    path('console-mail/templates/<int:pk>/preview/',TemplatePreviewView.as_view(),name='console-mail-template-preview'),
    path('console-mail/outbox/',OutboxDashboardView.as_view(),name='console-mail-outbox'),
    path('console-policy/<slug:section>/', ConsolePolicyView.as_view(), name='console-policy'),
    path('', include(router.urls)),
]