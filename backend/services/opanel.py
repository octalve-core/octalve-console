"""Safe OPanel read-only service boundary.

This is a first-party API for the authenticated service owner. It does not
proxy arbitrary provider URLs, create panel sessions, or reveal host credentials.
Each technical capability remains disabled until an account-scoped adapter is
separately tested and explicitly enabled.
"""
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Service, ServiceUsage
from opanel_bridge.policy import enabled, eligible


def opanel_overview(service):
    latest = ServiceUsage.objects.filter(service=service).first()
    usage = None if latest is None else {
        'disk_used_mb': latest.disk_used_mb,
        'disk_limit_mb': latest.disk_limit_mb,
        'bandwidth_used_mb': latest.bandwidth_used_mb,
        'bandwidth_limit_mb': latest.bandwidth_limit_mb,
        'recorded_at': latest.recorded_at.isoformat(),
    }
    return {
        'service_id': service.pk,
        'label': service.label,
        'domain_name': service.domain_name,
        'service_type': service.service_type,
        'status': service.status,
        'active': service.status == 'active' and bool(service.provider_identifier),
        'usage': usage,
        'usage_status': 'snapshot' if usage else 'unavailable',
        'capabilities': {
            'overview': True,
            'files': False,
            'subdomains': False,
            'dns': False,
            'databases': False,
            'ssl': False,
            'backups': False,
            'email': False,
            'panel_sso': bool(enabled() and eligible(service.client_id, service.pk)),
        },
        'message': (
            'Provider-backed OPanel management requires separately accepted '
            'account-scoped adapters. No server changes are enabled here.'
        ),
    }


class OPanelOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, service_id):
        service = get_object_or_404(Service, pk=service_id)
        user = request.user
        if service.client_id != user.pk and not (
            user.is_superuser or getattr(user, 'role', '') == 'admin'
        ):
            raise Http404()
        return Response(opanel_overview(service))
