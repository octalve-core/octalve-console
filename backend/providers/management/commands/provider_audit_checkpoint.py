"""Offline-only signed provider audit checkpoint; never uploads to a provider."""
import os
from django.core.management.base import BaseCommand, CommandError
from providers.audit_checkpoint import (
    MAX_CHECKPOINT_BYTES, build_audit_checkpoint, verify_audit_checkpoint,
)
from providers.connection_vault import VaultUnavailable


class Command(BaseCommand):
    help = "Offline export or verify an independently retained signed provider-audit checkpoint"

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group(required=True)
        mode.add_argument("--output", help="New local file for explicit offsite/WORM handoff")
        mode.add_argument("--verify", help="Previously retained checkpoint file to compare to current DB")
        parser.add_argument("--confirm", default="", help="Required export confirmation token")

    def handle(self, *args, **options):
        if options["output"]:
            if options["confirm"] != "EXPORT-PROVIDER-AUDIT-CHECKPOINT":
                raise CommandError("Explicit export confirmation is required.")
            try:
                receipt = build_audit_checkpoint()
                # Never overwrite a previous checkpoint, or follow a symlink.
                flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0)
                fd = os.open(options["output"], flags, 0o600)
                try:
                    with os.fdopen(fd, "wb") as stream:
                        stream.write(receipt)
                        stream.flush()
                        os.fsync(stream.fileno())
                except BaseException:
                    try:
                        os.unlink(options["output"])
                    except OSError:
                        pass
                    raise
            except (VaultUnavailable, OSError) as exc:
                raise CommandError("Checkpoint export refused; no source records changed.") from exc
            self.stdout.write("Checkpoint exported for independent immutable retention; external archival is NOT automatic.")
            return
        if options["confirm"]:
            raise CommandError("Export confirmation cannot be supplied in verify mode.")
        try:
            flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
            fd = os.open(options["verify"], flags)
            with os.fdopen(fd, "rb") as stream:
                receipt = stream.read(MAX_CHECKPOINT_BYTES + 1)
            result = verify_audit_checkpoint(receipt)
        except (VaultUnavailable, OSError) as exc:
            raise CommandError("Checkpoint verification failed; investigate possible database rollback or artifact substitution.") from exc
        self.stdout.write(
            "Verified %d retained connections against %d current connections."
            % (result["verified_checkpoint_connections"], result["current_connections"])
        )
