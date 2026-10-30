"""Server-side protection for global Console report/financial aggregates.

Authenticated client and staff sessions must not read all-tenant financial or
audit summaries, even if a frontend route is hidden or a BFF is present.
Only the explicit Admin role (or a real superuser) may access these endpoints.
"""
from rest_framework.permissions import BasePermission


class IsConsoleFinancialAdmin(BasePermission):
    message = "Admin reporting access is required."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or (getattr(user, "is_staff", False) and getattr(user, "role", None) == "admin"))
        )
