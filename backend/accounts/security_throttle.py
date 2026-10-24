"""Cross-instance, durable authentication throttling (SEC-01).

DRF's cache throttles are non-atomic and unsafe as a brute-force security
boundary in horizontally scaled functions. This middleware counts attempts
in the shared PostgreSQL database under a transaction/row lock.
"""
import hashlib
import hmac
import ipaddress
import json
import logging
import os
from datetime import timedelta

from django.conf import settings
from django.db import DatabaseError, transaction
from django.http import JsonResponse
from django.utils import timezone

from .models import AuthThrottleBucket

logger = logging.getLogger(__name__)

# Operation -> (per-IP requests, IP window seconds, per-identifier requests,
# identifier window seconds). Both independent scopes must pass.
POLICIES = {
    "/api/auth/jwt/create/": (30, 300, 8, 900),
    "/api/auth/register/": (5, 3600, None, None),
    "/api/auth/users/reset_password/": (8, 3600, 4, 3600),
    "/api/auth/users/reset_password_confirm/": (12, 3600, None, None),
    "/api/auth/jwt/refresh/": (120, 3600, None, None),
}


def _fingerprint(scope, value):
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        (scope + ":" + value).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _request_ip(request):
    # Vercel overwrites X-Forwarded-For at ingress. Never trust this header
    # on local/self-hosted deployments whose proxy has not been verified.
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR") if os.environ.get("VERCEL_ENV") else None
    candidate = (forwarded or request.META.get("REMOTE_ADDR") or "").split(",")[0].strip()
    try:
        return ipaddress.ip_address(candidate).compressed
    except ValueError:
        return "unattributed"


def _identifier(request, path):
    if path not in ("/api/auth/jwt/create/", "/api/auth/users/reset_password/"):
        return None
    # Bounded input; do not parse/store credentials. Django caches .body, so
    # the DRF view can still read and validate the original POST normally.
    if len(request.body) > 65536:
        return None
    try:
        payload = json.loads(request.body)
    except (ValueError, UnicodeDecodeError, TypeError):
        return None
    if not isinstance(payload, dict):
        return None
    value = payload.get("email") or payload.get("username")
    if not isinstance(value, str):
        return None
    value = value.strip().casefold()
    return value[:254] if value else None


def _spend(scope, value, limit, seconds):
    """Atomically consume one request on any number of Vercel instances."""
    fingerprint = _fingerprint(scope, value)
    now = timezone.now()
    with transaction.atomic():
        bucket, _ = AuthThrottleBucket.objects.select_for_update().get_or_create(
            fingerprint=fingerprint,
            defaults={"attempts": 0, "expires_at": now + timedelta(seconds=seconds)},
        )
        if bucket.expires_at <= now:
            bucket.attempts = 0
            bucket.expires_at = now + timedelta(seconds=seconds)
        if bucket.attempts >= limit:
            return max(1, int((bucket.expires_at - now).total_seconds()) + 1)
        bucket.attempts += 1
        bucket.save(update_fields=("attempts", "expires_at", "updated_at"))
    return 0


def _limit_response(wait, status):
    if status == 429:
        response = JsonResponse({"detail": "Too many requests. Please try again later."}, status=429)
        response["Retry-After"] = str(wait)
    else:
        response = JsonResponse({"detail": "Authentication is temporarily unavailable."}, status=503)
    response["Cache-Control"] = "no-store"
    return response


class AuthAbuseLimitMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if request.method != "POST" or path not in POLICIES:
            return self.get_response(request)

        ip_limit, ip_seconds, id_limit, id_seconds = POLICIES[path]
        ip = _request_ip(request)
        subject = _identifier(request, path) if id_limit else None
        try:
            # Each scope is unique by route family. Unknown identifiers are
            # also counted, resisting user-enumeration and IP rotation.
            wait = _spend(path + ":ip", ip, ip_limit, ip_seconds)
            if wait:
                return _limit_response(wait, 429)
            if subject is not None:
                wait = _spend(path + ":identity", subject, id_limit, id_seconds)
                if wait:
                    return _limit_response(wait, 429)
        except DatabaseError:
            # Unavailable database must never silently disable auth protections.
            logger.error("SEC01 throttle storage unavailable; authentication denied")
            return _limit_response(0, 503)
        return self.get_response(request)
