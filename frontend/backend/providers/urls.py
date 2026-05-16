# providers/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProviderViewSet, ProviderPackageViewSet, ProviderLogViewSet

router = DefaultRouter()
router.register(r'providers', ProviderViewSet, basename='provider')
router.register(r'packages', ProviderPackageViewSet, basename='provider-package')
router.register(r'logs', ProviderLogViewSet, basename='provider-log')

urlpatterns = [
    path('', include(router.urls)),
]