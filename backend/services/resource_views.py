"""Explicit authenticated resource routes, not a provider-command gateway."""
from django.db import DatabaseError
from django.shortcuts import get_object_or_404
from django.views.decorators.debug import sensitive_variables
from rest_framework.parsers import JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.security_throttle import _spend
from opanel_bridge.readback import ReadbackRejected
from providers.connection_vault import VaultUnavailable
from providers.pinned_egress import SupplierEgressDenied
from .models import Service
from .resource_protocol import ResourceRefused
from . import resource_management as resources

HEADERS={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}


def _owner(request,service_id):
    if (getattr(request.user,"role",None)!="client" or not request.user.is_active
            or getattr(request.user,"is_locked",False)):
        from rest_framework.exceptions import NotFound
        raise NotFound()
    return get_object_or_404(Service,pk=service_id,client_id=request.user.pk,service_type="hosting")


def _unavailable():
    return Response({"detail":"Hosting resource operation unavailable. Check service status, supplier permissions or contact support."},
                    status=409,headers=HEADERS)


class ResourceInventoryView(APIView):
    permission_classes=[IsAuthenticated]

    def get(self,request,service_id,resource):
        _owner(request,service_id)
        if request.query_params or resource not in ("email","subdomains"):
            return Response({"detail":"Unsupported resource request."},status=400,headers=HEADERS)
        try:
            return Response(resources.list_resources(request.user.pk,service_id,resource),headers=HEADERS)
        except (ResourceRefused,ReadbackRejected,VaultUnavailable,SupplierEgressDenied,DatabaseError):
            return _unavailable()


class MailboxCreateView(APIView):
    permission_classes=[IsAuthenticated]
    parser_classes=[JSONParser]

    @sensitive_variables("data","password","confirmation")
    def post(self,request,service_id):
        _owner(request,service_id)
        data=request.data
        if not isinstance(data,dict) or set(data)!={"local","password","quota_mb","confirm_password"}:
            return Response({"detail":"Provide mailbox name, password, quota and current Console password."},
                            status=400,headers=HEADERS)
        password=data["password"]
        confirmation=data["confirm_password"]
        try:
            if _spend("hosting:resource_stepup",str(request.user.pk),5,900):
                return Response({"detail":"Too many confirmation attempts."},status=429,headers=HEADERS)
            if (not isinstance(confirmation,str) or not 1<=len(confirmation)<=1024
                    or not request.user.check_password(confirmation)):
                return Response({"detail":"Current Console password could not be confirmed."},
                                status=403,headers=HEADERS)
            result=resources.create_mailbox(request.user.pk,service_id,local=data["local"],
                                            password=password,quota=data["quota_mb"])
            return Response(result,status=201 if result["state"]=="confirmed" else 202,headers=HEADERS)
        except (ResourceRefused,ReadbackRejected,VaultUnavailable,SupplierEgressDenied,DatabaseError):
            return _unavailable()


class MailboxReconcileView(APIView):
    permission_classes=[IsAuthenticated]
    parser_classes=[JSONParser]

    def post(self,request,service_id):
        _owner(request,service_id)
        if request.data!={}:
            return Response({"detail":"No additional fields are accepted."},status=400,headers=HEADERS)
        try:
            result=resources.reconcile_mailbox(request.user.pk,service_id)
            return Response(result,status=200 if result["state"]=="confirmed" else 202,headers=HEADERS)
        except (ResourceRefused,ReadbackRejected,VaultUnavailable,SupplierEgressDenied,DatabaseError):
            return _unavailable()
