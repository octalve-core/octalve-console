"""Cross-module authority for commerce configuration and supplier records.

Supplier packages and their wholesale prices are *internal*. The Octalve
retail catalog is visible to authenticated clients, but only an administrator
may publish or mutate the commercial offer. Do not use Django is_staff alone:
the Cloud account model has a separate application role field.
"""
from rest_framework.permissions import BasePermission, SAFE_METHODS


def is_cloud_admin(user):
    return bool(
        user
        and getattr(user, "is_authenticated", False)
        and (getattr(user, "is_superuser", False) or getattr(user, "role", None) == "admin")
    )


class CatalogPublicationAuthority(BasePermission):
    """Client/staff can read catalog; only admin can change offers."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not getattr(user, "is_authenticated", False):
            return False
        return request.method in SAFE_METHODS or is_cloud_admin(user)


class InternalSupplierAuthority(BasePermission):
    """Never expose wholesale package pricing/mappings to client accounts."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not getattr(user, "is_authenticated", False):
            return False
        if request.method not in SAFE_METHODS:
            return is_cloud_admin(user)
        return is_cloud_admin(user) or getattr(user, "role", None) == "staff"
