"""Bind Console bearer access to the existing durable refresh blacklist."""

from datetime import datetime, timezone

from django.db import transaction

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

REFRESH_ID = "console_refresh_jti"


class ConsoleRefreshToken(RefreshToken):
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
            outstanding = OutstandingToken.objects.select_for_update().filter(
                jti=presented[api_settings.JTI_CLAIM],
            ).first()
            if outstanding is None:
                raise InvalidToken("This session is no longer active.")
            result = super().validate(attrs)
            if "refresh" in result:
                # SimpleJWT serializes access before rotating the refresh JTI.
                result["access"] = str(self.token_class(result["refresh"]).access_token)
            return result


class ConsoleJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
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
