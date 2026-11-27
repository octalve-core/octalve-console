"""Operator-authorized WebAuthn enrollment on the canonical Console origin."""

import hashlib
import json
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from webauthn import generate_registration_options, options_to_json, verify_registration_response
from webauthn.helpers import bytes_to_base64url
from webauthn.helpers.exceptions import WebAuthnException
from webauthn.helpers.structs import AuthenticatorSelectionCriteria, UserVerificationRequirement

from audit.models import AuditLog
from .account_self_service import reserve_email_attempt
from .models import CustomUser, PrivilegedPasskey, PrivilegedPasskeyGrant
from .privileged_mfa import ORIGIN, RP_ID

GRANT_PATTERN = re.compile(r"[A-Za-z0-9_-]{43}")
DENIED = "Enrollment could not be verified. Request a new authorized setup code."


def is_privileged(user):
    return user.is_active and not user.is_locked and (
        user.is_staff or user.is_superuser or user.role in {"admin", "staff"}
    )


def audit_grant(grant, event):
    AuditLog.objects.create(
        action="settings_updated", entity_type="privileged_passkey",
        entity_id=str(grant.user_id), entity_name=event,
        details={"approval_reference": grant.approval_reference, "recovery": grant.recovery},
    )


@transaction.atomic
def issue_grant(user, approval_reference, recovery=False):
    user = CustomUser.objects.select_for_update().get(pk=user.pk)
    if not is_privileged(user):
        raise PermissionDenied(DENIED)
    code = secrets.token_urlsafe(32)
    PrivilegedPasskeyGrant.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())
    grant = PrivilegedPasskeyGrant.objects.create(
        digest=hashlib.sha256(code.encode()).hexdigest(), user=user,
        approval_reference=approval_reference, recovery=recovery,
        expires_at=timezone.now()+timedelta(minutes=15),
    )
    audit_grant(grant, "Enrollment authorization issued")
    return code


class PrivilegedPasskeyEnrollmentView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if not settings.CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED:
            raise NotFound()
        try:
            size = int(request.META.get("CONTENT_LENGTH", "0"))
        except (ValueError, TypeError):
            size = 0
        if not 1 <= size <= 32768:
            raise PermissionDenied(DENIED)
        data = request.data
        if not isinstance(data, dict) or set(data) not in ({"code", "password"}, {"code", "password", "credential"}):
            raise PermissionDenied(DENIED)
        code, password = data["code"], data["password"]
        if (not isinstance(code, str) or not GRANT_PATTERN.fullmatch(code)
                or not isinstance(password, str) or not 1 <= len(password) <= 1024):
            raise PermissionDenied(DENIED)
        digest = hashlib.sha256(code.encode()).hexdigest()
        if not reserve_email_attempt("passkey-enrollment", "global", 120, 60):
            raise PermissionDenied(DENIED)
        if not reserve_email_attempt("passkey-enrollment", digest, 6, 900):
            raise PermissionDenied(DENIED)
        grant_owner = PrivilegedPasskeyGrant.objects.filter(digest=digest).values_list("user_id", flat=True).first()
        if grant_owner is None:
            raise PermissionDenied(DENIED)
        initial_user = CustomUser.objects.filter(pk=grant_owner).first()
        if initial_user is None or not is_privileged(initial_user) or not initial_user.check_password(password):
            raise PermissionDenied(DENIED)
        with transaction.atomic():
            user = CustomUser.objects.select_for_update().get(pk=grant_owner)
            grant = PrivilegedPasskeyGrant.objects.select_for_update().filter(
                digest=digest, user=user, used_at__isnull=True, expires_at__gt=timezone.now(),
            ).first()
            if grant is None or not is_privileged(user) or user.password != initial_user.password:
                raise PermissionDenied(DENIED)
            if "credential" not in data:
                options = generate_registration_options(
                    rp_id=RP_ID, rp_name="Octalve Cloud",
                    user_id=str(user.pk).encode(), user_name=user.email,
                    timeout=120000, authenticator_selection=AuthenticatorSelectionCriteria(
                        user_verification=UserVerificationRequirement.REQUIRED,
                    ),
                )
                grant.challenge = options.challenge
                grant.save(update_fields=["challenge"])
                return Response({"public_key": json.loads(options_to_json(options))},
                                headers={"Cache-Control": "no-store"})

            if not grant.challenge or not isinstance(data["credential"], dict):
                raise PermissionDenied(DENIED)
            # Consume the challenge even if evidence fails. Another attempt requires an operator grant.
            grant.used_at = timezone.now()
            grant.save(update_fields=["used_at"])
            try:
                result = verify_registration_response(
                    credential=data["credential"], expected_challenge=bytes(grant.challenge),
                    expected_rp_id=RP_ID, expected_origin=ORIGIN, require_user_verification=True,
                )
                credential_id = bytes_to_base64url(result.credential_id)
                if len(credential_id) > 1024:
                    raise ValueError("Credential identifier too long")
                with transaction.atomic():
                    credential = PrivilegedPasskey.objects.create(
                        user=user, credential_id=credential_id, public_key=result.credential_public_key,
                        sign_count=result.sign_count,
                    )
            except (WebAuthnException, TypeError, ValueError, IntegrityError):
                credential = None
            if credential is not None:
                if grant.recovery:
                    PrivilegedPasskey.objects.filter(user=user, revoked_at__isnull=True).exclude(
                        pk=credential.pk,
                    ).update(revoked_at=timezone.now())
                    for token in OutstandingToken.objects.select_for_update().filter(
                        user=user, expires_at__gt=timezone.now(),
                    ).order_by("id"):
                        BlacklistedToken.objects.get_or_create(token=token)
                audit_grant(grant, "Privileged passkey recovered" if grant.recovery else "Privileged passkey enrolled")
        if credential is None:
            raise PermissionDenied(DENIED)
        return Response({"enrolled": True}, status=201, headers={"Cache-Control": "no-store"})
