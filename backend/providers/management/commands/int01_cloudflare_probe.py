"""Operator-only INT-01 smoke probe. No customer-facing HTTP credential form.

Examples (in an isolated, approved environment with secret-store variables):
  manage.py int01_cloudflare_probe --scope sandbox
  manage.py int01_cloudflare_probe --scope sandbox --domain owned-test-name.com
  manage.py int01_cloudflare_probe --scope dns --zone-id <32-hex-zone-id>
  manage.py int01_cloudflare_probe --scope sandbox --domain approved-test.com \
      --simulate-registration --confirm-sandbox-only
Never supply tokens on the command line, in email, chat or checked-in files.
"""
import json

from django.core.management.base import BaseCommand, CommandError

from providers.cloudflare_int01 import CloudflareINT01Denied, from_operator_environment


class Command(BaseCommand):
    help="Read-only Cloudflare DNS/sandbox probe and strictly optional sandbox-only registration."

    def add_arguments(self, parser):
        parser.add_argument("--scope", choices=("dns", "sandbox"), required=True)
        parser.add_argument("--zone-id", default=None)
        parser.add_argument("--domain", default=None)
        parser.add_argument("--simulate-registration", action="store_true")
        parser.add_argument("--confirm-sandbox-only", action="store_true")

    def handle(self, *args, **options):
        scope=options["scope"]
        zone_id=options["zone_id"]
        domain=options["domain"]
        simulate=options["simulate_registration"]
        confirm=options["confirm_sandbox_only"]
        if (scope=="dns" and (not zone_id or domain or simulate or confirm)
                or scope=="sandbox" and (zone_id or (simulate and (not domain or not confirm))
                    or (confirm and not simulate))):
            raise CommandError("Invalid or incomplete INT-01 operator test scope.")
        try:
            client=from_operator_environment(scope)
            if scope=="dns":
                result=client.dns_readback(zone_id)
            elif simulate:
                result=client.simulate_registration(domain,operator_approved=True)
            elif domain:
                result=client.check(domain)
            else:
                result=client.sandbox_readback()
        except CloudflareINT01Denied as exc:
            raise CommandError(str(exc)) from None
        # No Authorization header, payment details or registrar contact data.
        self.stdout.write(json.dumps({"INT01":scope,"result":result},
                                     sort_keys=True,separators=(",",":")))
