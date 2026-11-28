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
from domains.models import Domain
from opanel_bridge.policy import enabled, eligible, refresh_candidate
from . import native_panel, resource_management


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
        "disk_unlimited": latest.raw_data.get("disk_unlimited") is True if isinstance(latest.raw_data, dict) else False,
        "bandwidth_unlimited": latest.raw_data.get("bandwidth_unlimited") is True if isinstance(latest.raw_data, dict) else False,
        "recorded_at": latest.recorded_at.isoformat(),
        "resource_counts": {kind: latest.raw_data.get("resource_counts",{}).get(kind)
                            for kind in ("email","database","subdomains")}
                           if isinstance(latest.raw_data,dict) and isinstance(latest.raw_data.get("resource_counts"),dict)
                           and latest.raw_data.get("source")=="verified_supplier_usage_v1" else {},
    }
    # No writable adapter, DNS, TLS or live HTTP evidence exists at this
    # boundary. Statuses stay unverified regardless of service.status.
    resource_caps = resource_management.capabilities(service)
    capabilities = {
        "overview": True,
        "forwarders": "forwarder_read" in resource_caps,
        "autoresponders": "autoresponder_read" in resource_caps,
        "autoresponder_delete": "autoresponder_delete" in resource_caps,
        "autoresponder_create": "autoresponder_create" in resource_caps,
        "autoresponder_edit": "autoresponder_edit" in resource_caps and resource_management.database_initial_user_required(service),
        "forwarder_create": "forwarder_create" in resource_caps,
        "forwarder_delete": "forwarder_delete" in resource_caps,
        "credentials": "hosting_password" in resource_caps,
        "hosting_password": "hosting_password" in resource_caps,
        "files": False,
        "subdomains": "subdomain_read" in resource_caps,
        "dns": False,
        "databases": "database_read" in resource_caps,
        "database_create": "database_create" in resource_caps,
        "database_delete": "database_delete" in resource_caps,
        "db_users": "database_user_read" in resource_caps,
        "database_user_create": "database_user_create" in resource_caps,
        "database_user_delete": "database_user_delete" in resource_caps,
        "database_grants": "database_grants" in resource_caps,
        "database_user_requires_database": "database_user_read" in resource_caps and resource_management.database_initial_user_required(service),
        "database_initial_user_required": "database_create" in resource_caps and service.provider_id is not None and resource_management.database_initial_user_required(service),
        "ssl": False,
        "backups": False,
        "email": "mailbox_read" in resource_caps,
        "mail_client_settings": "mail_client_settings" in resource_caps and not resource_management.database_initial_user_required(service),
        "webmail_launch": "webmail_launch" in resource_caps and not resource_management.database_initial_user_required(service),
        "mailbox_create": "mailbox_create" in resource_caps,
        "mailbox_delete": "mailbox_delete" in resource_caps,
        "mailbox_quota": "mailbox_quota" in resource_caps,
        "mailbox_password": "mailbox_password" in resource_caps,
        "subdomain_create": "subdomain_create" in resource_caps,
        "subdomain_delete": "subdomain_delete" in resource_caps,
        "panel_sso": panel_allowed,
        "native_panel": native_panel.available(service),
        "panel_recheck": bool(not verified and enabled() and refresh_candidate(service.client_id, service.pk)),
    }
    now_due = service.next_due_date
    domain_id = Domain.objects.filter(client_id=service.client_id,domain_name=service.domain_name,is_active=True).values_list('pk',flat=True).first() if service.domain_name else None
    return {
        "service_id": service.pk,
        "domain_id": domain_id,
        "billing": {"amount":str(service.amount),"currency":service.currency,"cycle":service.billing_cycle,
                    "created_at":service.created_at.isoformat(),"auto_renew":service.auto_renew},
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


class NativePanelLaunchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, service_id):
        # POST is necessary: the vendor creates a temporary user session.
        headers = {"Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer"}
        if request.data not in ({}, None):
            return Response({"detail": "No custom session fields are accepted."}, status=400, headers=headers)
        if getattr(request.user, "role", "") != "client" or not request.user.is_active:
            return Response({"detail": "Hosting access unavailable."}, status=404, headers=headers)
        try:
            url = native_panel.launch(request.user.pk, service_id)
        except native_panel.NativePanelRefused:
            return Response({"detail": "Hosting access unavailable. Retry or contact support."},
                            status=403, headers=headers)
        return Response({"url": url}, headers=headers)
