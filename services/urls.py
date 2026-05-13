# services/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ServiceViewSet, ServiceChangeRequestViewSet

router = DefaultRouter()
router.register(r'services', ServiceViewSet, basename='service')
router.register(r'change-requests', ServiceChangeRequestViewSet, basename='change-request')

urlpatterns = [
    path('', include(router.urls)),
]