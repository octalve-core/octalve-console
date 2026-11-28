"""Bounded one-shot trusted hosting worker; remote dispatch separately gated."""
from django.core.management.base import BaseCommand, CommandError
from provisioning.automatic_staging import run_due_staging

class Command(BaseCommand):
    help = "Discover verified paid hosting lines and stage idempotent outbox tasks."

    def add_arguments(self, parser):
        parser.add_argument("--max-tasks",type=int,default=10)

    def handle(self,*args,**options):
        limit=options["max_tasks"]
        if not 1<=limit<=20:
            raise CommandError("Choose a batch size of 1–20.")
        result=run_due_staging(limit)
        from provisioning.automatic_dispatch import run_due_dispatch
        result["dispatch"]=run_due_dispatch(1)
        self.stdout.write(str(result))
