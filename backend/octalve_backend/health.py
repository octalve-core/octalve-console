"""Safe, public liveness response. Does not imply DB readiness or commercial health."""
from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health(request):
    return JsonResponse({"service": "octalve-cloud-api", "status": "ok"})
