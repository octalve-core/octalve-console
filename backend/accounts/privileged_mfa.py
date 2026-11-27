"""WebAuthn verification for privileged Console password exchanges."""

import json
from datetime import timedelta
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from webauthn import generate_authentication_options, options_to_json, verify_authentication_response
from webauthn.helpers import base64url_to_bytes
from webauthn.helpers.exceptions import WebAuthnException
from webauthn.helpers.structs import PublicKeyCredentialDescriptor, UserVerificationRequirement

from .models import CustomUser, PrivilegedLoginChallenge, PrivilegedPasskey

RP_ID = "console.cloud.octalve.com"
ORIGIN = "https://console.cloud.octalve.com"
ASSURANCE = "console_webauthn_verified"


def is_privileged_account(user):
    return user.is_staff or user.is_superuser or user.role in {"admin", "staff"}


def privileged_mfa_required(user):
    return settings.CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED and is_privileged_account(user)


def passkey_login_allowed(user):
    # Enrollment-only mode permits an explicit, non-mandatory browser qualification.
    return is_privileged_account(user) and (
        settings.CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED or privileged_mfa_required(user)
    )


@transaction.atomic
def begin_login(user):
    current = CustomUser.objects.select_for_update().filter(pk=user.pk).first()
    if current is None or not current.is_active or current.is_locked or current.password != user.password or not passkey_login_allowed(current):
        raise PermissionDenied("Account changed. Start a new sign-in.")
    credentials = list(PrivilegedPasskey.objects.filter(user=user, revoked_at__isnull=True))
    if not credentials:
        raise PermissionDenied("This privileged account requires an enrolled passkey.")
    options = generate_authentication_options(
        rp_id=RP_ID, timeout=120000,
        allow_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(item.credential_id))
                           for item in credentials],
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    challenge = PrivilegedLoginChallenge.objects.create(
        user=user, challenge=options.challenge, expires_at=timezone.now() + timedelta(minutes=2),
    )
    return {"code": "privileged_passkey_required", "challenge_id": str(challenge.pk),
            "public_key": json.loads(options_to_json(options))}


def verify_login(user, challenge_id, assertion):
    denied = "Passkey verification failed. Start a new sign-in."
    if not isinstance(challenge_id, str) or len(challenge_id) != 36 or not isinstance(assertion, dict):
        raise PermissionDenied(denied)
    if len(json.dumps(assertion)) > 16384:
        raise PermissionDenied(denied)
    credential_id = assertion.get("id")
    if not isinstance(credential_id, str) or len(credential_id) > 1024:
        raise PermissionDenied(denied)
    try:
        challenge_key = UUID(challenge_id)
    except ValueError:
        raise PermissionDenied(denied) from None
    with transaction.atomic():
        # Serialize challenges and assertions against recovery using account-first locks.
        current = CustomUser.objects.select_for_update().filter(pk=user.pk).first()
        if current is None or not current.is_active or current.is_locked or current.password != user.password or not passkey_login_allowed(current):
            raise PermissionDenied(denied)
        challenge = PrivilegedLoginChallenge.objects.select_for_update().filter(
            pk=challenge_key, user=user, used_at__isnull=True, expires_at__gt=timezone.now(),
        ).first()
        if challenge is None:
            raise PermissionDenied(denied)
        challenge.used_at = timezone.now()
        challenge.save(update_fields=["used_at"])
        credential = PrivilegedPasskey.objects.select_for_update().filter(
            user=user, credential_id=credential_id, revoked_at__isnull=True,
        ).first()
        verified = None
        if credential:
            try:
                result = verify_authentication_response(
                    credential=assertion, expected_challenge=bytes(challenge.challenge),
                    expected_rp_id=RP_ID, expected_origin=ORIGIN,
                    credential_public_key=bytes(credential.public_key),
                    credential_current_sign_count=credential.sign_count,
                    require_user_verification=True,
                )
                if result.credential_id == base64url_to_bytes(credential.credential_id):
                    credential.sign_count = result.new_sign_count
                    credential.save(update_fields=["sign_count"])
                    verified = credential.pk
            except (WebAuthnException, ValueError, TypeError):
                pass
    if verified is None:
        raise PermissionDenied(denied)
    return verified

def has_passkey_assurance(user, token):
    credential_id = token.get(ASSURANCE)
    return type(credential_id) is int and PrivilegedPasskey.objects.filter(
        pk=credential_id, user=user, revoked_at__isnull=True,
    ).exists()
