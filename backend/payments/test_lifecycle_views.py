"""Operator test workbench and authenticated scheduled sandbox processing."""
import os
import secrets

from django.db import DatabaseError
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError, Throttled
from django.shortcuts import get_object_or_404

from accounts.security_throttle import _spend
from billing.models import Invoice
from octalve_backend.resource_lookup import resource_lookup
from .hosted_checkout import CheckoutRefused
from .test_lifecycle import enabled, safe_snapshot, review_historical_events, run_due_work, advance_renewals, simulate_refund


class TestLifecycleCronView(APIView):
    authentication_classes=[]
    permission_classes=[AllowAny]
    def get(self, request):
        key=os.environ.get("CRON_SECRET","")
        header=request.headers.get("Authorization","")
        if len(key)<32 or not secrets.compare_digest(header.encode(),("Bearer "+key).encode()):
            return Response({"detail":"Unauthorized."},status=401)
        if not enabled():
            return Response({"detail":"Test worker disabled."},status=503)
        return Response(run_due_work(),headers={"Cache-Control":"no-store"})


class TestLifecycleAdminView(APIView):
    permission_classes=[IsAuthenticated]

    def _guard(self,request):
        user=request.user
        if not(user.is_active and user.is_superuser and user.is_staff and user.role=="admin" and user.email_verified_at):
            raise PermissionDenied()
        if not enabled():
            raise NotFound()

    def get(self,request):
        self._guard(request)
        return Response({"mode":"simulation","historical_review":review_historical_events()},headers={"Cache-Control":"private, no-store"})

    def post(self,request):
        self._guard(request)
        if not isinstance(request.data,dict) or set(request.data)!={"invoice","action","confirm"} or request.data.get("confirm") is not True:
            raise ValidationError("Confirm the sandbox-only exercise.")
        wait=_spend("payments:test_lifecycle_admin",str(request.user.pk),10,300)
        if wait:
            raise Throttled(wait=wait)
        action=request.data.get("action")
        if action not in ("renewal_rehearsal","refund_rehearsal"):
            raise ValidationError("Unsupported sandbox action.")
        invoice=get_object_or_404(Invoice.objects.select_related("order"),**resource_lookup(request.data["invoice"]))
        if not invoice.order_id or not safe_snapshot(invoice.order):
            raise NotFound()
        try:
            if action=="renewal_rehearsal":
                value=safe_snapshot(invoice.order)
                due=max(parse_datetime(item["next_due"]) for item in value["items"])
                advance_renewals(invoice.pk,at=due)
            else:
                simulate_refund(invoice.pk)
        except CheckoutRefused:
            raise ValidationError("Payment evidence requires review.") from None
        invoice.order.refresh_from_db()
        return Response({"test_lifecycle":safe_snapshot(invoice.order)},headers={"Cache-Control":"private, no-store"})
