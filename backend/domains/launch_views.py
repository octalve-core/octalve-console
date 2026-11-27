"""Super Admin registrar qualification workbench. All supplier calls read-only."""
from django.db import DatabaseError
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from catalog.permissions import InternalSupplierAuthority
from providers.connection_stepup import assert_admin, check_mutation
from providers.connection_views import VaultMutationThrottle
from providers.connection_vault import VaultUnavailable
from providers.connection_models import IntegrationCredentialVersion
from providers.cloudflare_int01 import CloudflareINT01Denied
from octalve_backend.resource_lookup import resource_lookup
from audit.models import AuditLog
from billing.models import Invoice
from .models import TLDPricing
from .launch_readiness import price_review, supplier_status, sandbox_quote, registration_review

@api_view(["GET","POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def registrar_launch_review(request):
    assert_admin(request.user)
    headers={"Cache-Control":"private, no-store"}
    if request.method=="GET":
        from .sandbox_fulfillment import automation_status
        rows=list(TLDPricing.objects.order_by("sort_order","tld")[:101])
        return Response({"mode":"read_only","suppliers":supplier_status(),"rates":[price_review(r) for r in rows[:100]],
                         "truncated":len(rows)>100,"execution_enabled":False,"sandbox_automation":automation_status()},headers=headers)
    data=request.data
    if not isinstance(data,dict):
        raise ValidationError("Use the reviewed registrar fields.")
    action=data.get("action")
    required={"action","domain","confirm_password","totp_code"}
    if action=="registration":
        required.add("invoice")
    if action not in ("quote","registration","catalogue") or set(data)!=required:
        raise ValidationError("Use the reviewed registrar fields.")
    check_mutation(request.user,data["confirm_password"],data["totp_code"])
    try:
        if action=="quote":
            result=sandbox_quote(data["domain"])
        elif action=="catalogue":
            from .supplier_catalogue import import_cloudflare_catalogue
            result=import_cloudflare_catalogue(data["domain"], request.user)
        else:
            invoice=get_object_or_404(Invoice.objects.select_related("order","client"),**resource_lookup(data["invoice"]))
            result=registration_review(invoice,data["domain"])
        AuditLog.objects.create(actor=request.user,action="provider_connection_test",entity_type="RegistrarSandbox",
            entity_id=result["domain"],entity_name="Cloudflare sandbox readback",
            details={"operation":action,"read_only":True,"execution_enabled":False,"checked_at":result["checked_at"]})
    except (CloudflareINT01Denied,VaultUnavailable,IntegrationCredentialVersion.DoesNotExist,DatabaseError,KeyError):
        return Response({"detail":"Sandbox supplier verification is unavailable. No operation was submitted."},status=503,headers=headers)
    return Response(result,headers=headers)
