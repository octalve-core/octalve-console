"""MFA-protected mail sender approval in the existing Integration Store."""
from django.db import DatabaseError
from rest_framework.decorators import api_view,permission_classes,throttle_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from catalog.permissions import InternalSupplierAuthority
from providers.connection_views import require_write_authority,VaultMutationThrottle
from providers.connection_models import IntegrationConnection
from providers.connection_vault import VaultUnavailable
from settings_registry.mail_runtime import configure
from settings_registry.brevo_transport import SenderRefused


@api_view(["POST"])
@permission_classes([InternalSupplierAuthority])
@throttle_classes([VaultMutationThrottle])
def configure_sender(request,connection_id):
    data=request.data
    if (not isinstance(data,dict) or set(data)!={"confirm_password","totp_code","sender_email","accept"}
            or data["accept"] is not True):
        raise ValidationError("Confirm the exact transactional sender policy.")
    require_write_authority(request)
    try:
        result=configure(connection_id,data["sender_email"],request.user)
    except (IntegrationConnection.DoesNotExist,DatabaseError,VaultUnavailable,SenderRefused):
        raise ValidationError("Sender, domain or current vault authority could not be verified.") from None
    return Response(result,headers={"Cache-Control":"private, no-store"})
