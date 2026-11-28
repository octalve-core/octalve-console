"""Execute one commercial lane using existing database and provider fences."""
import json
from time import monotonic
from django.core.management.base import BaseCommand, CommandError
from services.commercial_scheduler import LANES, execute

class Command(BaseCommand):
    help="Run one bounded commercial worker lane."

    def add_arguments(self, parser):
        parser.add_argument("lane",choices=LANES)

    def handle(self,*args,**options):
        deadline=monotonic()+90
        progress_keys=("processed","staged","completed","accepted","issued","applied",
                       "reminders","suspended","restored","cancelled","terminated","recorded","expired")
        for _ in range(8):
            result=execute(options["lane"])
            self.stdout.write(json.dumps(result,sort_keys=True))
            if result.get("state") in ("failed","held"):
                raise CommandError("Commercial worker unavailable; retry via scheduler.")
            if (monotonic()>=deadline or not any(type(result.get(key)) is int and
                    result[key]>0 for key in progress_keys)):
                break
