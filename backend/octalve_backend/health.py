"""Safe, public liveness response. Does not imply DB readiness or commercial health."""
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .public_status import status_report


@require_GET
def health(request):
    return JsonResponse({"service": "octalve-cloud-api", "status": "ok"})


@require_GET
def public_service_status(request):
    """Application liveness is not evidence of wider service availability."""
    return JsonResponse(
        status_report(),
        headers={"Cache-Control": "no-store"},
    )
