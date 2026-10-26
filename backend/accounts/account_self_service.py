"""Own-account contact details, password recovery, and email verification.

These endpoints never update financial truth or another user's profile.
Customer-facing email actions require an approved transactional mail transport.
"""
from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AuthThrottleBucket

User = get_user_model()
VERIFY_SALT = "octalve-cloud-email-verification-v1"
VERIFY_TTL_SECONDS = 60 * 60 * 24
RECOVERY_TTL_SECONDS = 60 * 60


class OwnProfileSerializer(serializers.ModelSerializer):
    email_verified = serializers.SerializerMethodField()
    email = serializers.EmailField(read_only=True)

    class Meta:
        model = User
        fields = (
            "email", "email_verified", "full_name", "phone_number",
            "company_name", "address", "city", "state", "country",
            "postal_code", "tax_id",
        )
        read_only_fields = ("email", "email_verified")
        extra_kwargs = {
            "full_name": {"allow_blank": True, "required": False},
            "phone_number": {"allow_blank": True, "required": False},
            "company_name": {"allow_blank": True, "required": False},
            "address": {"allow_blank": True, "required": False},
            "city": {"allow_blank": True, "required": False},
            "state": {"allow_blank": True, "required": False},
            "country": {"allow_blank": True, "required": False},
            "postal_code": {"allow_blank": True, "required": False},
            "tax_id": {"allow_blank": True, "required": False},
        }

    def get_email_verified(self, obj):
        return obj.email_verified_at is not None

    def validate(self, attrs):
        disallowed = set(self.initial_data) - set(self.fields)
        if disallowed:
            raise serializers.ValidationError("Only contact and billing details can be changed.")
        for key, value in attrs.items():
            if isinstance(value, str):
                clean = value.strip()
                if any(ord(character) < 32 for character in clean):
                    raise serializers.ValidationError({key: "Invalid characters."})
                attrs[key] = clean
        return attrs


class OwnProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(OwnProfileSerializer(request.user).data)

    def patch(self, request):
        serializer = OwnProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


def email_transport_ready():
    backend = getattr(settings, "EMAIL_BACKEND", "")
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "")
    return bool(
        getattr(settings, "CLOUD_ACCOUNT_EMAIL_ENABLED", False)
        and isinstance(from_email, str)
        and "@" in from_email
        and backend
        and backend not in (
            "django.core.mail.backends.filebased.EmailBackend",
            "django.core.mail.backends.console.EmailBackend",
            "django.core.mail.backends.dummy.EmailBackend",
            "django.core.mail.backends.locmem.EmailBackend",
        )
    )


def public_origin():
    from urllib.parse import urlsplit
    origin = str(getattr(settings, "FRONTEND_URL", "")).rstrip("/")
    parsed = urlsplit(origin)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username
            or parsed.password or parsed.query or parsed.fragment
            or parsed.path not in ("", "/") or parsed.port not in (None, 443)):
        raise ValueError("Public account URL unavailable.")
    return origin


def throttle_identifier(scope, identity):
    from django.utils.crypto import salted_hmac
    return salted_hmac(
        "octalve-account-mail-" + scope, str(identity).lower(),
        secret=settings.SECRET_KEY, algorithm="sha256",
    ).hexdigest()


def reserve_email_attempt(scope, identity, limit=3, window_seconds=900):
    """Durable rate budget across serverless instances; fail closed on DB outage."""
    fingerprint = throttle_identifier(scope, identity)
    with transaction.atomic():
        bucket, _ = AuthThrottleBucket.objects.get_or_create(
            fingerprint=fingerprint,
            defaults={"expires_at": timezone.now() + timedelta(seconds=window_seconds)},
        )
        bucket = AuthThrottleBucket.objects.select_for_update().get(pk=fingerprint)
        now = timezone.now()
        if bucket.expires_at <= now:
            bucket.attempts = 0
            bucket.expires_at = now + timedelta(seconds=window_seconds)
        if bucket.attempts >= limit:
            return False
        bucket.attempts += 1
        bucket.save(update_fields=["attempts", "expires_at", "updated_at"])
    return True


def service_unavailable():
    return Response({"detail": "Account email service is temporarily unavailable."}, status=503)


class PasswordRecoveryRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        if not email or len(email) > 254:
            return Response({"email": ["Enter a valid email address."]}, status=400)
        if not email_transport_ready():
            return service_unavailable()
        try:
            origin = public_origin()
        except ValueError:
            return service_unavailable()
        if not reserve_email_attempt("password-reset", email):
            return Response({"detail": "Please try again later."}, status=429)

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = origin + "/reset-password/confirm/" + quote(uid, safe="") + "/" + quote(token, safe="")
            try:
                send_mail(
                    "Reset your Octalve Cloud password",
                    "To reset your password, open this link within one hour:\n" + link +
                    "\n\nIf you did not request this, you can ignore this message.",
                    settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False,
                )
            except Exception:
                # Same public result whether this email exists or the provider failed;
                # operator monitoring must inspect delivery errors without logging tokens.
                pass
        return Response(
            {"detail": "If the address belongs to an account, password recovery instructions will be sent."},
            status=202,
        )


class EmailVerificationRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not email_transport_ready():
            return service_unavailable()
        user = request.user
        if user.email_verified_at:
            return Response({"email_verified": True})
        try:
            origin = public_origin()
        except ValueError:
            return service_unavailable()
        if not reserve_email_attempt("verification", user.pk):
            return Response({"detail": "Please try again later."}, status=429)
        token = signing.dumps(
            {"uid": user.pk, "email": user.email, "auth": user.get_session_auth_hash()},
            salt=VERIFY_SALT,
        )
        # The token is in a URL fragment, never sent to the frontend web server.
        link = origin + "/verify-email#token=" + quote(token, safe="")
        try:
            send_mail(
                "Verify your Octalve Cloud email",
                "Confirm your email address using this link within 24 hours:\n" + link +
                "\n\nIf you did not request this, you can ignore this message.",
                settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False,
            )
        except Exception:
            return service_unavailable()
        return Response({"detail": "Verification instructions were sent."}, status=202)


class EmailVerificationConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("token")
        if not isinstance(token, str) or len(token) > 4096:
            return Response({"detail": "Verification link is invalid or expired."}, status=400)
        try:
            data = signing.loads(token, salt=VERIFY_SALT, max_age=VERIFY_TTL_SECONDS)
            if not isinstance(data, dict) or not isinstance(data.get("uid"), int):
                raise ValueError("Invalid token")
        except (signing.BadSignature, signing.SignatureExpired, ValueError, TypeError):
            return Response({"detail": "Verification link is invalid or expired."}, status=400)
        with transaction.atomic():
            user = User.objects.select_for_update().filter(pk=data["uid"], is_active=True).first()
            if (not user or user.email_verified_at or
                    user.email != data.get("email") or
                    user.get_session_auth_hash() != data.get("auth")):
                return Response({"detail": "Verification link is invalid or already used."}, status=400)
            user.email_verified_at = timezone.now()
            user.save(update_fields=["email_verified_at"])
        return Response({"email_verified": True}, status=200)
