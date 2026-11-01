"""Super Admin, read-only Cloudflare INT-01 certification probe.

The browser never sends a supplier credential, server URL, registration
contact or arbitrary path. A production operator must set the explicit
backend flag plus scoped server-side secret-store environment variables.
"""
import os
from django.db import DatabaseError
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, Throttled
from rest_framework.response import Response

from catalog.permissions import InternalSupplierAuthority
from .connection_stepup import assert_admin
from accounts.security_throttle import _spend
from .cloudflare_int01 import from_operator_environment, CloudflareINT01Denied

@api_view(["GET"])
@permission_classes([InternalSupplierAuthority])
def probe(request):
    assert_admin(request.user)
    if os.getenv("INT01_CLOUDFLARE_ADMIN_READBACK_ENABLED") != "true":
        return Response({"detail":"Read-only provider verification has not been enabled by the operator."},
            status=503,headers={"Cache-Control":"private, no-store"})
    scope=request.query_params.get("scope","")
    if set(request.query_params)!={"scope"} or scope not in ("dns","sandbox"):
        return Response({"detail":"Only the documented read-only probe is supported."},
            status=400,headers={"Cache-Control":"private, no-store"})
    try:
        retry=_spend("int01:cloudflare-readback",str(request.user.pk),6,3600)
    except DatabaseError:
        return Response({"detail":"Provider verification cannot be rate-limited safely."},
            status=503,headers={"Cache-Control":"private, no-store"})
    if retry:
        raise Throttled(wait=retry)
    try:
        client=from_operator_environment(scope)
        if scope=="dns":
            zone_id=os.getenv("INT01_CLOUDFLARE_ZONE_ID","")
            result=client.dns_readback(zone_id)
        else:
            result=client.sandbox_readback()
    except CloudflareINT01Denied:
        return Response({"detail":"Authenticated provider readback was not verified.","verified":False},
            status=503,headers={"Cache-Control":"private, no-store"})
    from audit.models import AuditLog
    try:
        AuditLog.objects.create(
            actor=request.user,action="provider_connection_test",
            entity_type="integration",entity_name="Cloudflare INT-01",
            details={"provider":"cloudflare","scope":scope,"verified":True,
                     "side_effects":False,"checked_at":timezone.now().isoformat()})
    except DatabaseError:
        return Response({"detail":"Provider readback succeeded but the audit receipt was not retained."},
            status=503,headers={"Cache-Control":"private, no-store"})
    return Response({"provider":"cloudflare","scope":scope,"verified":True,
                     "sandbox_only":scope=="sandbox","execution_enabled":False,
                     "evidence":result,"checked_at":timezone.now().isoformat()},
            headers={"Cache-Control":"private, no-store"})
