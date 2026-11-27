"""Track Console token families using the existing durable blacklist tables."""

from datetime import datetime, timezone
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone as django_timezone

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from .privileged_mfa import ASSURANCE, has_passkey_assurance, privileged_mfa_required

REFRESH_ID = "console_refresh_jti"
SESSION_ID = "console_session_id"


def require_passkey_policy(user, token):
    # A passkey-bound token must never outlive its credential, including after
    # rollback of mandatory enforcement. Ordinary legacy sessions do not query
    # the new table when both flags are off and the schema is not yet migrated.
    if (ASSURANCE in token.payload or privileged_mfa_required(user)) and not has_passkey_assurance(user, token):
        raise InvalidToken("Privileged sign-in requires passkey verification.")


def session_record(session_id, user_id, *, lock=False):
    records = OutstandingToken.objects.filter(jti=session_id, user_id=user_id, token="")
    return (records.select_for_update() if lock else records).first()


def require_session(session_id, user_id, *, lock=False):
    record = session_record(session_id, user_id, lock=lock)
    if record is None or record.expires_at <= django_timezone.now() or BlacklistedToken.objects.filter(token_id=record.pk).exists():
        raise InvalidToken("This session is no longer active.")
    return record


def bind_session(refresh, user_id):
    refresh[SESSION_ID] = uuid4().hex
    return OutstandingToken.objects.create(
        user_id=user_id, jti=refresh[SESSION_ID], token="",
        expires_at=datetime.fromtimestamp(refresh["exp"], timezone.utc),
    )


class ConsoleRefreshToken(RefreshToken):
    @classmethod
    def for_user(cls, user):
        with transaction.atomic():
            refresh = super().for_user(user)
            bind_session(refresh, user.pk)
            return refresh

    @property
    def access_token(self):
        access = super().access_token
        access[REFRESH_ID] = self[api_settings.JTI_CLAIM]
        return access


class ConsoleTokenRefreshSerializer(TokenRefreshSerializer):
    token_class = ConsoleRefreshToken

    def validate(self, attrs):
        presented = self.token_class(attrs["refresh"])
        with transaction.atomic():
            session_id = presented.get(SESSION_ID)
            user_id = presented.get(api_settings.USER_ID_CLAIM)
            user = get_user_model().objects.filter(pk=user_id).first()
            if user:
                require_passkey_policy(user, presented)
            session = require_session(session_id, user_id, lock=True) if session_id else None
            outstanding = OutstandingToken.objects.select_for_update().filter(
                jti=presented[api_settings.JTI_CLAIM],
            ).first()
            if outstanding is None:
                raise InvalidToken("This session is no longer active.")
            result = super().validate(attrs)
            if "refresh" in result:
                # SimpleJWT serializes access before rotating the refresh JTI.
                rotated = self.token_class(result["refresh"])
                if session:
                    session.expires_at = datetime.fromtimestamp(rotated["exp"], timezone.utc)
                    session.save(update_fields=["expires_at"])
                else:
                    bind_session(rotated, user_id)
                    result["refresh"] = str(rotated)
                result["access"] = str(rotated.access_token)
            return result


class ConsoleJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        require_passkey_policy(user, validated_token)
        session_id = validated_token.get(SESSION_ID)
        if session_id:
            require_session(session_id, user.pk)
            return user
        refresh_id = validated_token.get(REFRESH_ID)
        token_id = refresh_id or validated_token[api_settings.JTI_CLAIM]
        if BlacklistedToken.objects.filter(token__jti=token_id, token__user_id=user.pk).exists():
            raise InvalidToken("This session is no longer active.")
        return user


def revoke_legacy_access(token, user):
    """Revoke the presented pre-rollout access token without storing its bearer value."""
    if token is None or token.get(REFRESH_ID):
        return
    outstanding, _ = OutstandingToken.objects.get_or_create(
        jti=token[api_settings.JTI_CLAIM],
        defaults={"user": user, "token": "", "expires_at": datetime.fromtimestamp(token["exp"], timezone.utc)},
    )
    BlacklistedToken.objects.get_or_create(token=outstanding)
