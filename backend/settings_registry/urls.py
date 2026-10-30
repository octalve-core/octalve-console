# settings_registry/urls.py

from django.urls import path, include
from .console_views import ConsolePolicyView
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
    path('console-policy/<slug:section>/', ConsolePolicyView.as_view(), name='console-policy'),
    path('', include(router.urls)),
]