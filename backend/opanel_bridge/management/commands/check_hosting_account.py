"""Explicit operator-only readback. Does NOT provision or enable paid hosting."""
from django.core.management.base import BaseCommand, CommandError
from opanel_bridge.readback import ReadbackRejected, readback_service


class Command(BaseCommand):
    help = "Verify an EXISTING DirectAdmin/WHM account (read-only vendor API). Default is no database writes."

    def add_arguments(self, parser):
        parser.add_argument("--service-id", type=int, required=True)
        parser.add_argument("--apply", action="store_true", help="Store verified evidence if readback succeeds; revoke on failure")

    def handle(self, *args, **options):
        if options["service_id"] < 1:
            raise CommandError("A positive internal service ID is required.")
        try:
            result = readback_service(options["service_id"], apply=options["apply"])
        except ReadbackRejected as exc:
            raise CommandError(str(exc)) from None
        operation = "EVIDENCE_RECORDED" if options["apply"] else "READ_ONLY_VERIFIED"
        self.stdout.write(self.style.SUCCESS(
            f"{operation}: service={result.service_id}, adapter={result.adapter}, checked_at={result.checked_at.isoformat()}"
        ))
