"""Batch 18.1: read-only Admin staff account overview, no privilege mutations."""
from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class AdminStaffRosterView(APIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]

    def get(self, request):
        operator = request.user
        if not operator.is_active or not (
            operator.is_superuser or getattr(operator, "role", None) == "admin"
        ):
            return Response({"detail": "Permission denied."}, status=403)
        User = get_user_model()
        users = list(
            User.objects.filter(role="staff")
            .select_related("staff_profile")
            .order_by("pk")[:51]
        )
        rows = []
        for user in users[:50]:
            profile = getattr(user, "staff_profile", None)
            rows.append({
                "id": str(user.pk),
                "full_name": user.full_name or user.username,
                "email": user.email,
                "department": profile.department if profile else "",
                "job_title": profile.job_title if profile else "",
                "two_factor_enabled": bool(user.two_factor_enabled),
                "status": "active" if user.is_active else "inactive",
                "date": user.updated_at.isoformat(),
            })
        return Response({
            "results": rows,
            "count": len(rows),
            "truncated": len(users) > 50,
            "read_only": True,
            "operations_enabled": False,
        }, headers={"Cache-Control": "private, no-store"})
