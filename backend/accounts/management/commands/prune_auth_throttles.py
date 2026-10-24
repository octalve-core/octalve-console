"""Prune expired pseudonymous auth buckets; review before modifying any DB."""
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.models import AuthThrottleBucket


class Command(BaseCommand):
    help = "Review or remove expired authentication throttle records."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Actually delete expired buckets")
        parser.add_argument("--grace-hours", type=int, default=24)

    def handle(self, *args, **options):
        hours = options["grace_hours"]
        if hours < 24:
            raise CommandError("Minimum cleanup grace period is 24 hours.")
        before = timezone.now() - timedelta(hours=hours)
        items = AuthThrottleBucket.objects.filter(expires_at__lt=before)
        count = items.count()
        if not options["apply"]:
            self.stdout.write(f"PLAN ONLY: {count} expired throttle buckets eligible; no deletion.")
            return
        removed, _ = items.delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {removed} expired throttle bucket records."))
