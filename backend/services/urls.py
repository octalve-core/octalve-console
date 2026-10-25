# services/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ServiceViewSet, ServiceChangeRequestViewSet
from .opanel import OPanelOverviewView

router = DefaultRouter()
router.register(r'services', ServiceViewSet, basename='service')
router.register(r'change-requests', ServiceChangeRequestViewSet, basename='change-request')

urlpatterns = [
    path('opanel/<int:service_id>/overview/', OPanelOverviewView.as_view(), name='opanel-overview'),
    path('', include(router.urls)),
]