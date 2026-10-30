"""Anonymous username hint; never a reservation or authorization decision.

The public response contains only availability of one syntactically valid
candidate. Shared PostgreSQL request throttling protects against enumeration.
Registration still re-checks uniqueness and handles concurrent insert races.
"""
import re
from django.contrib.auth import get_user_model
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

RESERVED_USERNAMES = frozenset({
    "admin", "administrator", "root", "support", "security", "billing",
    "system", "octalve", "api", "staff",
})
USERNAME_PATTERN = re.compile(r"[a-z][a-z0-9_]{2,29}\Z", re.ASCII)


class UsernameAvailabilityView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    http_method_names = ["post", "options"]
    # Rely on the durable IP throttle middleware rather than per-instance DRF cache.

    def post(self, request):
        candidate = request.data.get("username")
        if not isinstance(candidate, str) or len(candidate) > 60:
            result = {"available": False}
        else:
            candidate = candidate.strip().lower()
            valid = bool(USERNAME_PATTERN.fullmatch(candidate)) and candidate not in RESERVED_USERNAMES
            result = {"available": bool(valid and not get_user_model().objects.filter(
                username__iexact=candidate).exists())}
        response = Response(result)
        response["Cache-Control"] = "private, no-store"
        return response
