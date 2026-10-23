"""Django deployment-security audit with deliberately scoped HSTS exceptions.

Django recommends W005/W021 only after all subdomains are HTTPS-safe and
a domain is preload-ready. We do not yet control the state of every sibling
Octalve domain; explicitly reject other warnings instead of disabling checks.
"""
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "octalve_backend.settings")
import django
django.setup()
from django.conf import settings
from django.core.checks import Tags, run_checks

# HSTS is enforced for the current host; a conservative 1h policy avoids
# prematurely forcing ALL future subdomains into HTTPS/preload.
ACCEPTED = {"security.W005", "security.W021"}
assert settings.SECURE_HSTS_INCLUDE_SUBDOMAINS is False
assert settings.SECURE_HSTS_PRELOAD is False
assert settings.SECURE_HSTS_SECONDS > 0
assert settings.SECURE_SSL_REDIRECT is True

results = run_checks(tags=[Tags.security], include_deployment_checks=True)
issues = [issue for issue in results if issue.id not in ACCEPTED]
for issue in results:
    prefix = "INTENTIONALLY DEFERRED" if issue.id in ACCEPTED else "BLOCKING"
    print(f"{prefix}: {issue.id} {issue.msg}", file=sys.stderr)
if issues:
    raise SystemExit(f"Release blocked: {len(issues)} unexpected Django security warnings")
print("PASS: HTTPS/HSTS deployment security checks; W005/W021 accepted by explicit subdomain policy.")
