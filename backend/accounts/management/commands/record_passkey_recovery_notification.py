"""Record independently verified notification delivery, never send mail or secrets."""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from audit.models import AuditLog
from accounts.models import CustomUser


class Command(BaseCommand):
    help = "Record a post-recovery out-of-band notification receipt for an exact recovery event."

    def add_arguments(self, parser):
        parser.add_argument("--account-id", type=int, required=True)
        parser.add_argument("--recovery-audit-id", type=int, required=True)
        parser.add_argument("--approval-reference", required=True)
        parser.add_argument("--notification-reference", required=True)
        parser.add_argument("--confirm-independent-delivery", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        approval = options["approval_reference"].strip()
        receipt = options["notification_reference"].strip()
        if not options["confirm_independent_delivery"] or not (1 <= len(approval) <= 100 and 1 <= len(receipt) <= 100):
            raise CommandError("Independent notification delivery confirmation and references required.")
        user = CustomUser.objects.select_for_update().filter(pk=options["account_id"]).first()
        if user is None:
            raise CommandError("Account not found.")
        event = AuditLog.objects.filter(pk=options["recovery_audit_id"], entity_type="privileged_passkey",
            entity_id=str(user.pk), action="settings_updated", entity_name="Privileged passkey recovered",
            details__approval_reference=approval, details__recovery=True).first()
        if event is None:
            raise CommandError("Exact account-bound approved recovery audit event not found.")
        existing = AuditLog.objects.filter(entity_type="privileged_passkey", entity_id=str(user.pk),
            entity_name="Recovery notification delivery recorded", details__recovery_audit_id=event.pk).first()
        if existing:
            if existing.details.get("notification_reference") != receipt:
                raise CommandError("Different notification receipt already recorded; review audit.")
            self.stdout.write("Notification receipt already recorded.")
            return
        AuditLog.objects.create(action="settings_updated", entity_type="privileged_passkey", entity_id=str(user.pk),
            entity_name="Recovery notification delivery recorded",
            details={"recovery_audit_id": event.pk, "approval_reference":approval, "notification_reference":receipt})
        self.stdout.write("Operator-attested notification receipt recorded. No message sent.")
