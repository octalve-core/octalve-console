"""Human-approved review-only recovery evidence; never emits credentials."""
import json
from django.core.management.base import BaseCommand, CommandError
from providers.recovery_evidence import verify_coherent_review_recovery
from providers.connection_vault import VaultUnavailable


class Command(BaseCommand):
    help = "Read-only synthetic/review vault recovery + signed audit coherence check"

    def add_arguments(self, parser):
        parser.add_argument("--confirm", default="",
            help="Required: VERIFY-ISOLATED-PROVIDER-RECOVERY")

    def handle(self, *args, **options):
        if options["confirm"] != "VERIFY-ISOLATED-PROVIDER-RECOVERY":
            raise CommandError("Explicit isolated recovery confirmation is required.")
        try:
            report = verify_coherent_review_recovery()
        except VaultUnavailable as exc:
            raise CommandError(
                "Provider recovery acceptance FAILED; do not activate credentials."
            ) from exc
        self.stdout.write(json.dumps(report, sort_keys=True))
        self.stderr.write(
            "This verifies only an in-memory SQLite vault drill, not full Neon "
            "or externally retained immutable evidence."
        )
