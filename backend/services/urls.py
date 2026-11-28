# services/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ServiceViewSet, ServiceChangeRequestViewSet
from .opanel import OPanelOverviewView, NativePanelLaunchView
from .commercial_scheduler import CommercialWorkerView
from .renewal_views import RenewalPolicyView,RenewalCronView,LifecyclePolicyView,CancellationPolicyView
from .resource_views import ResourceInventoryView, MailboxCreateView, MailboxReconcileView, ResourceMutationView, ResourceReconcileView, MailboxSettingsView, MailboxWebmailView

router = DefaultRouter()
router.register(r'services', ServiceViewSet, basename='service')
router.register(r'change-requests', ServiceChangeRequestViewSet, basename='change-request')

urlpatterns = [
    path('commercial-worker/<str:lane>/cron/', CommercialWorkerView.as_view(), name='commercial-worker-cron'),
    path('cancellation-policy/', CancellationPolicyView.as_view(), name='hosting-cancellation-policy'),
    path('lifecycle-policy/', LifecyclePolicyView.as_view(), name='hosting-lifecycle-policy'),
    path('renewal-policy/', RenewalPolicyView.as_view(), name='hosting-renewal-policy'),
    path('renewals/cron/', RenewalCronView.as_view(), name='hosting-renewals-cron'),
    path('opanel/<int:service_id>/overview/', OPanelOverviewView.as_view(), name='opanel-overview'),
    path('opanel/<int:service_id>/native-launch/', NativePanelLaunchView.as_view(), name='native-panel-launch'),
    path('opanel/<int:service_id>/resources/<str:resource>/', ResourceInventoryView.as_view(), name='hosting-resource-list'),
    path('opanel/<int:service_id>/mailboxes/<str:local>/settings/', MailboxSettingsView.as_view(), name='hosting-mailbox-settings'),
    path('opanel/<int:service_id>/mailboxes/<str:local>/webmail/', MailboxWebmailView.as_view(), name='hosting-mailbox-webmail'),
    path('opanel/<int:service_id>/mailboxes/create/', MailboxCreateView.as_view(), name='hosting-mailbox-create'),
    path('opanel/<int:service_id>/mailboxes/reconcile/', MailboxReconcileView.as_view(), name='hosting-mailbox-reconcile'),
    path('opanel/<int:service_id>/resource-actions/reconcile/', ResourceReconcileView.as_view(), name='hosting-resource-reconcile'),
    path('opanel/<int:service_id>/resource-actions/<str:operation>/', ResourceMutationView.as_view(), name='hosting-resource-mutation'),
    path('', include(router.urls)),
]