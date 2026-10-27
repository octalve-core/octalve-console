"""Offline verifier of signed append-only event chain; never prints secrets."""
from django.core.management.base import BaseCommand,CommandError
from providers.connection_models import IntegrationConnection
from providers.connection_audit import verify_chain
from providers.connection_vault import VaultUnavailable

class Command(BaseCommand):
    help="Verify the bound signed audit chain for all bounded provider connections"
    def handle(self,*args,**kwargs):
        rows=list(IntegrationConnection.objects.order_by("pk")[:1001])
        if len(rows)>1000: raise CommandError("Connection audit too large for bounded verification.")
        events=0
        try:
            for row in rows:
                events+=verify_chain(row)["events"]
        except VaultUnavailable as exc:
            raise CommandError("Provider audit integrity could not be confirmed.") from exc
        self.stdout.write("Verified %d connections and %d signed audit events."%(len(rows),events))
