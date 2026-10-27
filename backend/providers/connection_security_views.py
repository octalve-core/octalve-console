"""Review-gated Super Admin TOTP enrollment, distinct from Console login MFA."""
from django.conf import settings
from django.db.utils import OperationalError,ProgrammingError
from rest_framework.decorators import api_view,permission_classes,throttle_classes
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from catalog.permissions import InternalSupplierAuthority
from .connection_views import VaultMutationThrottle
from .connection_stepup import start,confirm,assert_admin
from .connection_models import ProviderVaultAuthenticator

@api_view(["GET"])
@permission_classes([InternalSupplierAuthority])
def status(request):
    assert_admin(request.user)
    try:
        record=ProviderVaultAuthenticator.objects.filter(user=request.user).first()
    except (OperationalError,ProgrammingError):
        return Response({"detail":"Provider security is not available yet."},status=503)
    return Response({"verified":bool(record and record.verified),"kind":"totp",
        "enrollment_available":bool(getattr(settings,"CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED",False)),
        "provider_execution_enabled":False},headers={"Cache-Control":"no-store"})

@api_view(["POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def enroll(request):
    if set(request.data)!={"confirm_password"}: raise ValidationError({"detail":"Unexpected enrollment fields."})
    return Response(start(request.user,request.data.get("confirm_password")),
                    headers={"Cache-Control":"no-store","Pragma":"no-cache"})

@api_view(["POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def approve(request):
    if set(request.data)!={"confirm_password","totp_code"}: raise ValidationError({"detail":"Unexpected enrollment fields."})
    return Response(confirm(request.user,request.data.get("confirm_password"),request.data.get("totp_code")),
                    headers={"Cache-Control":"no-store"})
