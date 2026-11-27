"""Independently approved operator-only individual credential revocation."""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from audit.models import AuditLog
from accounts.models import CustomUser, PrivilegedPasskey
from accounts.privileged_mfa import is_privileged_account


class Command(BaseCommand):
    help = "Revoke one credential only after independent approval and a verified surviving credential."

    def add_arguments(self, parser):
        parser.add_argument("--account-id", type=int, required=True)
        parser.add_argument("--credential-record-id", type=int, required=True)
        parser.add_argument("--approval-reference", required=True)
        parser.add_argument("--confirm-independent-approval", action="store_true")
        parser.add_argument("--confirm-surviving-authenticator-and-notification", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        ref = options["approval_reference"].strip()
        if not (1 <= len(ref) <= 100 and options["confirm_independent_approval"] and options["confirm_surviving_authenticator_and_notification"]):
            raise CommandError("Independent authorization, verified surviving authenticator and notification required.")
        user = CustomUser.objects.select_for_update().filter(pk=options["account_id"]).first()
        if user is None or not user.is_active or user.is_locked or not is_privileged_account(user):
            raise CommandError("Eligible privileged account required.")
        keys = list(PrivilegedPasskey.objects.select_for_update().filter(user=user, revoked_at__isnull=True).order_by("pk"))
        target = next((key for key in keys if key.pk == options["credential_record_id"]), None)
        if target is None:
            raise CommandError("Active credential not found for this account.")
        survivors = [key.pk for key in keys if key.pk != target.pk]
        # A separate successful assertion is required; physical independence
        # and notification are operational attestations, not inferred by count.
        if not survivors or not AuditLog.objects.filter(actor=user, action="login", entity_type="privileged_passkey", entity_name="Privileged passkey sign-in", details__credential_record_id__in=survivors).exists():
            raise CommandError("Refusing revocation without a separately verified surviving credential.")
        target.revoked_at = timezone.now()
        target.save(update_fields=["revoked_at"])
        AuditLog.objects.create(action="settings_updated", entity_type="privileged_passkey", entity_id=str(user.pk), entity_name="Privileged passkey revoked", details={"approval_reference":ref,"credential_record_id":target.pk})
        # All passkey-bound access/refresh already check active credential state.
        # Unrelated credential sessions remain valid. Recovery is a separate flow.
        self.stdout.write("Credential revoked; surviving verified credential preserved.")
