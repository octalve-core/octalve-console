"""Offline only: preflight all ciphertext; explicit guarded atomic rewrap."""
from django.core.management.base import BaseCommand,CommandError
from providers.connection_vault import rewrap_versions,VaultUnavailable

class Command(BaseCommand):
    help="Dry-run or explicitly rewrap all bounded provider credential versions under the active key"
    def add_arguments(self,parser):
        parser.add_argument("--apply",action="store_true",help="Apply, rather than inspect")
        parser.add_argument("--confirm",default="",help="Required literal: REWRAP-PROVIDER-VAULT")
    def handle(self,*args,**opts):
        if opts["apply"] and opts["confirm"]!="REWRAP-PROVIDER-VAULT":
            raise CommandError("Explicit offline rewrap confirmation missing.")
        if not opts["apply"] and opts["confirm"]:
            raise CommandError("Confirmation is only permitted with --apply.")
        try: result=rewrap_versions(apply=opts["apply"])
        except VaultUnavailable as exc:
            raise CommandError("Vault preflight/rewrap failed; no credential rows were changed.") from exc
        self.stdout.write("Verified credential versions: %d; key updates: %d; mode: %s"%
            (result["examined"],result["rewrapped"],"apply" if result["applied"] else "dry-run"))
