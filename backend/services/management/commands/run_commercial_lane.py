"""Execute one commercial lane using existing database and provider fences."""
import json
from django.core.management.base import BaseCommand, CommandError
from services.commercial_scheduler import LANES, execute

class Command(BaseCommand):
    help="Run one bounded commercial worker lane."

    def add_arguments(self, parser):
        parser.add_argument("lane",choices=LANES)

    def handle(self,*args,**options):
        result=execute(options["lane"])
        self.stdout.write(json.dumps(result,sort_keys=True))
        if result.get("state")=="failed":
            raise CommandError("Commercial worker failed; inspect operational status.")
