"""Scheduled, read-only freshness check for the already approved test binding.

This cannot create or rotate credentials, bind another gateway, enable live
collection, or bypass the authenticated vault lifecycle. It renews only an
existing current-version verification receipt after genuine provider readback.
"""
from datetime import timedelta
from django.conf import settings
from django.db import DatabaseError, transaction
from django.utils import timezone
from audit.models import AuditLog
from providers.connection_audit import verify_chain
from providers.connection_models import IntegrationConnection, IntegrationCredentialVersion
from providers.connection_status import verification_receipts
from providers.connection_vault import unseal_version, VaultUnavailable
from providers.connection_views import connection_database_qualified
from providers.connection_verification import paystack_readback, ProviderReadbackFailed
from .models import PaymentGateway
from .domain_pilot_scope import pilot_test_gateway
from .vault_binding import SOURCE_KEY, VERSION_KEY

def refresh_bound_test_verification():
    from .automatic_reconciliation import enabled
    if not (enabled() and getattr(settings,"CLOUD_PAYSTACK_TEST_BINDING_ENABLED",False)
            and getattr(settings,"CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED",False)
            and getattr(settings,"CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED",False)
            and getattr(settings,"CLOUD_PROVIDER_CUSTODY_VERIFIED",False)
            and not settings.DEBUG and connection_database_qualified()):
        return "disabled"
    try:
        gateway=PaymentGateway.objects.filter(code="paystack",test_mode=True,status="test").first()
        if not gateway or not pilot_test_gateway(gateway) or set(gateway.config)!={SOURCE_KEY,VERSION_KEY}:
            return "not_bound"
        binding=dict(gateway.config)
        version=binding[VERSION_KEY]
        if type(version) is not int or version<1:
            return "held"
        row=IntegrationConnection.objects.filter(pk=binding[SOURCE_KEY],adapter_key="paystack",
            environment="test",state="draft",current_version=version).first()
        if not row:
            return "held"
        previous=verification_receipts([row]).get(str(row.pk))
        # No initial verification or new credential approval from the scheduler.
        if previous is None:
            return "held"
        if previous>=timezone.now()-timedelta(days=5):
            return "fresh"
        verify_chain(row)
        credential=IntegrationCredentialVersion.objects.select_related("connection").get(
            connection=row,version=version,revoked_at__isnull=True)
        key=unseal_version(credential).get("secret_key")
        proof=paystack_readback(key,"test")
        if not (proof.get("authenticated") is True and proof.get("environment")=="test"
                and proof.get("read_only") is True and proof.get("payment_collection_enabled") is False):
            return "held"
        with transaction.atomic():
            # Same connection -> gateway lock order as the approved binding action.
            current=IntegrationConnection.objects.select_for_update().get(pk=row.pk)
            locked=PaymentGateway.objects.select_for_update().get(pk=gateway.pk)
            if (current.adapter_key!="paystack" or current.state!="draft" or current.environment!="test"
                    or current.current_version!=version or current.updated_at!=row.updated_at
                    or not pilot_test_gateway(locked) or locked.config!=binding
                    or not IntegrationCredentialVersion.objects.filter(pk=credential.pk,
                        connection=current,version=version,revoked_at__isnull=True).exists()):
                return "held"
            verify_chain(current)
            latest=verification_receipts([current]).get(str(current.pk))
            if latest is None:
                return "held"
            if latest>=timezone.now()-timedelta(days=5):
                return "fresh"
            AuditLog.objects.create(actor=None,action="provider_connection_test",
                entity_type="IntegrationConnection",entity_id=str(current.pk),entity_name="paystack",
                details={"adapter":"paystack","credential_version":version,
                         "verified":True,"read_only":True,"execution_enabled":False,
                         "source":"scheduled_bound_test_readback",
                         "checked_at":timezone.now().isoformat()})
        return "refreshed"
    except (DatabaseError, VaultUnavailable, ProviderReadbackFailed,
            IntegrationConnection.DoesNotExist, IntegrationCredentialVersion.DoesNotExist,
            PaymentGateway.DoesNotExist, ValueError, TypeError, KeyError):
        return "held"
