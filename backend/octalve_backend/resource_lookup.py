"""UUID routing without weakening existing filtered querysets or permissions."""
import re
from uuid import UUID

from django.shortcuts import get_object_or_404
from rest_framework.exceptions import NotFound

UUID4 = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")


def resource_lookup(value):
    value = str(value)
    if UUID4.fullmatch(value):
        return {"public_id": UUID(value)}
    if re.fullmatch(r"[1-9][0-9]{0,14}", value):
        return {"pk": int(value)}
    raise NotFound()


class ResourceIdentityLookupMixin:
    """Compatibility integer lookups remain scoped; canonical clients use UUID."""
    def get_object(self):
        queryset = self.filter_queryset(self.get_queryset())
        key = self.lookup_url_kwarg or self.lookup_field
        obj = get_object_or_404(queryset, **resource_lookup(self.kwargs.get(key, "")))
        self.check_object_permissions(self.request, obj)
        return obj
