# provisioning/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProvisioningTaskViewSet, ProvisioningQueueViewSet, ProvisioningWebhookViewSet
)

router = DefaultRouter()
router.register(r'tasks', ProvisioningTaskViewSet, basename='provisioning-task')
router.register(r'queues', ProvisioningQueueViewSet, basename='provisioning-queue')
router.register(r'webhooks', ProvisioningWebhookViewSet, basename='provisioning-webhook')

urlpatterns = [
    path('', include(router.urls)),
]