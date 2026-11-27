"""Own-account metadata only; factor changes remain independently authorized."""
from django.conf import settings
from django.db.models import Count, Max
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from audit.models import AuditLog
from .models import PrivilegedPasskey
from .privileged_mfa import ASSURANCE, is_privileged_account


class OwnPrivilegedPasskeyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.is_active or user.is_locked or not is_privileged_account(user):
            raise PermissionDenied("Privileged account required.")
        # Never expose public-key bytes, credential IDs, grant hashes, challenges,
        # other accounts, device guesses or raw token material.
        records = list(PrivilegedPasskey.objects.filter(user=user).order_by("created_at").values("id", "created_at", "revoked_at"))
        events = AuditLog.objects.filter(actor=user, action="login", entity_type="privileged_passkey", entity_name="Privileged passkey sign-in").values("details__credential_record_id").annotate(last_used=Max("created_at"), verified_logins=Count("id"))
        by_id = {row["details__credential_record_id"]: row for row in events}
        active = 0
        verified = 0
        current = request.auth.get(ASSURANCE) if hasattr(request.auth, "get") else None
        for record in records:
            event = by_id.get(record["id"], {})
            record["last_used_at"] = event.get("last_used")
            record["verified_logins"] = event.get("verified_logins", 0)
            record["current_session"] = current == record["id"] and record["revoked_at"] is None
            if record["revoked_at"] is None:
                active += 1
                verified += bool(record["last_used_at"])
        return Response({
            "enrollment_enabled": settings.CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED,
            "enforcement_required": settings.CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED,
            "active_count": active, "verified_active_count": verified,
            "records": records,
        }, headers={"Cache-Control": "private, no-store"})
