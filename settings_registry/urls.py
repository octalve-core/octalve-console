# settings_registry/urls.py

from django.urls import path, include
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
    path('', include(router.urls)),
]