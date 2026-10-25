"""Console launch issuer / confidential-client exchange. No provider API calls."""
import base64
import hashlib
import hmac
import re
import secrets
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import OPanelLaunchGrant
from .policy import eligible, enabled

CHALLENGE = re.compile(r"^[A-Za-z0-9_-]{43,128}$")
STATE = re.compile(r"^[A-Za-z0-9_-]{22,128}$")
CODE = re.compile(r"^[A-Za-z0-9_-]{48,128}$")


def blocked(code=403):
    return Response({"detail": "OPanel entitlement unavailable."}, status=code, headers={"Cache-Control": "no-store"})


def service_client(request):
    expected = getattr(settings, "OPANEL_CLIENT_SECRET", "")
    client_id = getattr(settings, "OPANEL_CLIENT_ID", "octalve-opanel")
    auth = request.headers.get("Authorization", "")
    claimed = request.headers.get("X-OPanel-Client-ID", "")
    return (
        enabled() and bool(expected)
        and hmac.compare_digest(claimed, client_id)
        and auth.startswith("Bearer ")
        and hmac.compare_digest(auth[7:], expected)
    )


class AuthorizeView(APIView):
    """Called only by already-authenticated Console BFF from its first-party page."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not enabled():
            return blocked(503)
        try:
            service_id = int(request.data.get("service_id"))
        except (TypeError, ValueError, OverflowError):
            return blocked(404)
        state = request.data.get("state")
        challenge = request.data.get("code_challenge")
        if not isinstance(state, str) or not STATE.fullmatch(state):
            return blocked(400)
        if not isinstance(challenge, str) or not CHALLENGE.fullmatch(challenge):
            return blocked(400)
        found = eligible(request.user.pk, service_id)
        if not found:
            return blocked(404)
        service, proof = found
        code = secrets.token_urlsafe(48)
        OPanelLaunchGrant.objects.create(
            code_digest=hashlib.sha256(code.encode()).hexdigest(),
            service=service, subject=request.user, binding=proof,
            code_challenge=challenge, redirect_uri=settings.OPANEL_CALLBACK_URL,
            expires_at=timezone.now() + timedelta(seconds=60),
        )
        return Response(
            {"code": code, "state": state, "redirect_uri": settings.OPANEL_CALLBACK_URL},
            headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"},
        )


class ExchangeView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if not service_client(request):
            return blocked(401)
        code = request.data.get("code")
        verifier = request.data.get("code_verifier")
        redirect_uri = request.data.get("redirect_uri")
        if not isinstance(code, str) or not CODE.fullmatch(code):
            return blocked(400)
        if not isinstance(verifier, str) or not CHALLENGE.fullmatch(verifier):
            return blocked(400)
        if redirect_uri != settings.OPANEL_CALLBACK_URL:
            return blocked(400)
        digest = hashlib.sha256(code.encode()).hexdigest()
        calculated = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        with transaction.atomic():
            grant = OPanelLaunchGrant.objects.select_for_update().filter(code_digest=digest).first()
            if (
                grant is None
                or grant.consumed_at is not None
                or grant.expires_at <= timezone.now()
                or not hmac.compare_digest(grant.code_challenge, calculated)
                or grant.redirect_uri != redirect_uri
            ):
                return blocked(403)
            # Check eligibility again *inside* the redemption transaction.
            found = eligible(grant.subject_id, grant.service_id)
            if not found or found[1].pk != grant.binding_id:
                return blocked(403)
            grant.consumed_at = timezone.now()
            grant.save(update_fields=["consumed_at"])
            return Response({
                "subject_id": grant.subject_id,
                "service_id": grant.service_id,
                "binding_ref": str(grant.binding.binding_ref),
                "capabilities": ["overview"],
            }, headers={"Cache-Control": "no-store"})


class EntitlementView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if not service_client(request):
            return blocked(401)
        try:
            subject_id = int(request.data.get("subject_id"))
            service_id = int(request.data.get("service_id"))
        except (TypeError, ValueError, OverflowError):
            return blocked(404)
        found = eligible(subject_id, service_id)
        if not found:
            return blocked(404)
        service, proof = found
        return Response({
            "subject_id": service.client_id,
            "service_id": service.pk,
            "binding_ref": str(proof.binding_ref),
            "capabilities": ["overview"],
        }, headers={"Cache-Control": "no-store"})
