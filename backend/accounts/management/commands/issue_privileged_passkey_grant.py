"""Issue an enrollment grant after independent identity and change approval."""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from rest_framework.exceptions import PermissionDenied

from accounts.models import CustomUser
from accounts.passkey_enrollment import issue_grant


class Command(BaseCommand):
    help = "Issue a one-time privileged passkey grant to an independently verified operator."

    def add_arguments(self, parser):
        parser.add_argument("--account-id", type=int, required=True)
        parser.add_argument("--approval-reference", required=True)
        parser.add_argument("--recovery", action="store_true")
        parser.add_argument("--notification-reference", help="Independent pre-recovery notification delivery reference (not message content).")
        parser.add_argument("--confirm-independent-approval", action="store_true")

    def handle(self, *args, **options):
        if not settings.CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED:
            raise CommandError("Privileged passkey enrollment is disabled.")
        approval = options["approval_reference"].strip()
        if not options["confirm_independent_approval"] or not 1 <= len(approval) <= 100:
            raise CommandError("Provide the independently approved change reference.")
        notification = (options.get("notification_reference") or "").strip()
        if options["recovery"] and not 1 <= len(notification) <= 100:
            raise CommandError("Recovery requires an independent pre-recovery notification reference.")
        user = CustomUser.objects.filter(pk=options["account_id"]).first()
        if user is None:
            raise CommandError("No eligible privileged account.")
        try:
            code = issue_grant(user, approval, recovery=options["recovery"], notification_reference=notification if options["recovery"] else None)
        except PermissionDenied as exc:
            raise CommandError("No eligible privileged account.") from exc
        self.stderr.write("Deliver this 15-minute code through the approved private channel.")
        self.stdout.write(code)
