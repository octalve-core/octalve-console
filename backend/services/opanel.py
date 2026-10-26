"""Account-scoped, read-only Console hosting status for the independent OPanel.

This endpoint does NOT check DNS over the network, create panel sessions, invoke
a hosting supplier, write records or claim that a website is publicly live.
Only the OPanel issuer performs the actual single-use SSO grant.
"""
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Service, ServiceUsage
from opanel_bridge.policy import enabled, eligible


def opanel_overview(service):
    """Explicit customer-safe representation with independent readiness gates."""
    proof = eligible(service.client_id, service.pk)
    verified = proof is not None
    panel_allowed = bool(verified and enabled())
    latest = ServiceUsage.objects.filter(service=service).first()
    usage = None if latest is None else {
        "disk_used_mb": latest.disk_used_mb,
        "disk_limit_mb": latest.disk_limit_mb,
        "bandwidth_used_mb": latest.bandwidth_used_mb,
        "bandwidth_limit_mb": latest.bandwidth_limit_mb,
        "recorded_at": latest.recorded_at.isoformat(),
    }
    # No writable adapter, DNS, TLS or live HTTP evidence exists at this
    # boundary. Statuses stay unverified regardless of service.status.
    capabilities = {
        "overview": True,
        "files": False,
        "subdomains": False,
        "dns": False,
        "databases": False,
        "ssl": False,
        "backups": False,
        "email": False,
        "panel_sso": panel_allowed,
    }
    now_due = service.next_due_date
    return {
        "service_id": service.pk,
        "label": service.label,
        "domain_name": service.domain_name,
        "service_type": service.service_type,
        "status": service.status,
        "next_due_date": now_due.isoformat(),
        "active": verified,
        "usage": usage,
        "usage_status": "recorded" if usage else "unavailable",
        "hosting_account_verified": verified,
        "website_public_status": "unverified",
        "dns_public_status": "unverified",
        "ssl_public_status": "unverified",
        "readiness": {
            "hosting_account": "verified" if verified else "pending",
            "panel_access": "available" if panel_allowed else "unavailable",
            "files": "unavailable",
            "domain_dns": "unverified",
            "public_https": "unverified",
            "public_website": "unverified",
            "verification_checked_at": (
                proof[1].confirmed_at.isoformat() if verified else None
            ),
        },
        "capabilities": capabilities,
        "message": (
            "Hosting management will become available after your service "
            "and account are independently verified. Domain and website "
            "checks are completed separately."
        ),
    }


class OPanelOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, service_id):
        # Restrict the customer-facing overview to the precise owning client.
        # Staff and admins have separately authorized operational workspaces;
        # this path must never act as a cross-tenant service enumerator.
        service = get_object_or_404(
            Service, pk=service_id, client_id=request.user.pk
        )
        if getattr(request.user, "role", "") != "client" or not request.user.is_active:
            return Response({"detail": "Hosting status unavailable."}, status=404)
        return Response(
            opanel_overview(service),
            headers={"Cache-Control": "private, no-store"},
        )
