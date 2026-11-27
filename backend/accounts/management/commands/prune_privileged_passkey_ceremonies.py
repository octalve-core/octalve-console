"""Bounded operator-only cleanup; audit records and credentials are never removed."""
from datetime import timedelta
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from accounts.models import PrivilegedLoginChallenge, PrivilegedPasskeyGrant


class Command(BaseCommand):
    help = "Dry-run expired ceremonies older than seven days; apply only with explicit approval."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true")
        parser.add_argument("--approval-reference")
        parser.add_argument("--limit", type=int, default=1000)

    @transaction.atomic
    def handle(self, *args, **options):
        limit = options["limit"]
        if not 1 <= limit <= 5000:
            raise CommandError("Limit must be 1 through 5000.")
        if options["apply"] and not (options["approval_reference"] and 1 <= len(options["approval_reference"].strip()) <= 100):
            raise CommandError("Approved retention reference required for cleanup.")
        cutoff = timezone.now() - timedelta(days=7)
        for model in (PrivilegedLoginChallenge, PrivilegedPasskeyGrant):
            candidates = model.objects.filter(expires_at__lt=cutoff).order_by("expires_at")
            ids = list(candidates.values_list("pk", flat=True)[:limit])
            if options["apply"]:
                count, _ = candidates.filter(pk__in=ids).delete()
            else:
                count = len(ids)
            self.stdout.write(f"{model.__name__}: {'deleted' if options['apply'] else 'eligible'} {count}")
        self.stdout.write("Credentials and audit logs retained.")
