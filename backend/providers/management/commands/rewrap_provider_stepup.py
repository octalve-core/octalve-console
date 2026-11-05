"""Offline-only, atomic TOTP encryption-key rollover. Never returns MFA secrets."""
from django.core.management.base import BaseCommand, CommandError
from providers.connection_stepup import rewrap_stepup_authenticators
from providers.connection_vault import VaultUnavailable


class Command(BaseCommand):
    help = "Dry-run or explicitly rewrap TOTP secrets under the active versioned step-up key"

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Apply after independent backup proof")
        parser.add_argument("--confirm", default="", help="Required: REWRAP-PROVIDER-STEPUP")

    def handle(self, *args, **options):
        if options["apply"] and options["confirm"] != "REWRAP-PROVIDER-STEPUP":
            raise CommandError("Explicit offline TOTP rewrap confirmation missing.")
        if not options["apply"] and options["confirm"]:
            raise CommandError("Confirmation is only allowed with --apply.")
        try:
            result = rewrap_stepup_authenticators(apply=options["apply"])
        except VaultUnavailable as exc:
            raise CommandError("TOTP recovery preflight failed; no authenticator was changed.") from exc
        self.stdout.write(
            "Verified authenticators: %d; rewrapped: %d; mode: %s" %
            (result["examined"], result["rewrapped"],
             "apply" if result["applied"] else "dry-run")
        )
