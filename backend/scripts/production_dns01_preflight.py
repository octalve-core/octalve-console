"""DNS-01 Production migration preflight -- strictly read-only.

Use on the trusted operator workstation against the exact unpooled Neon
Production endpoint, only after reviewing the committed DNS-01 migration.
This script HAS NO APPLY MODE, opens no production writes and handles no
vendor credentials. It does not replace the independent backup/restore drill.
"""
import os
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "octalve_backend.settings")

EXPECTED_HOST = "ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech"
EXPECTED_DATABASE = "neondb"
EXPECTED_ROLE = "neondb_owner"
EXPECTED_BEFORE = (62, 115)
EXPECTED_PENDING = [("domains", "0002_dns_readonly_binding")]


def refuse(reason):
    raise SystemExit("DNS-01 PREFLIGHT REFUSED: " + reason)


def checked_url():
    url = os.getenv("DATABASE_URL", "")
    try:
        part = urlsplit(url)
        query = parse_qs(part.query)
        valid = (
            part.scheme in ("postgres", "postgresql")
            and part.hostname == EXPECTED_HOST
            and part.username == EXPECTED_ROLE
            and bool(part.password)
            and part.path == "/" + EXPECTED_DATABASE
            and part.port in (None, 5432)
            and query.get("sslmode") in (["require"], ["verify-full"])
            and not part.fragment
            and not part.hostname.endswith("-pooler.c-14.us-east-1.aws.neon.tech")
        )
    except (TypeError, ValueError):
        valid = False
    if not valid:
        refuse("Exact direct Production host, role, database and TLS settings are required.")
    return url


def inspect_db(conn):
    with conn.cursor() as cursor:
        cursor.execute("""SELECT current_database(), current_user,
            (SELECT COUNT(*) FROM public.django_migrations),
            (SELECT COUNT(*) FROM pg_catalog.pg_tables WHERE schemaname='public')""")
        db, role, migrations, tables = cursor.fetchone()
        cursor.execute("SELECT app, name FROM public.django_migrations")
        applied = set(cursor.fetchall())
        cursor.execute("""SELECT to_regclass('public.domains_domaindnsbinding'),
                                  to_regclass('public.providers_integrationconnectionevent')""")
        binding, events = cursor.fetchone()
    if (db, role) != (EXPECTED_DATABASE, EXPECTED_ROLE):
        refuse("Connected database or login role differs from the approved Production target.")
    if (migrations, tables) != EXPECTED_BEFORE:
        refuse("Production migration/table counts differ from the reviewed 62/115 baseline.")
    if binding is not None:
        refuse("DNS authorization table already exists; do not repeat or overwrite migration.")
    required = {
        ("domains", "0001_initial"),
        ("providers", "0002_integration_draft_vault"),
        ("providers", "0003_provider_vault_authenticator"),
        ("providers", "0004_provider_event_integrity"),
    }
    if not required.issubset(applied) or ("domains", "0002_dns_readonly_binding") in applied:
        refuse("Existing domain/provider migrations do not match approved authority.")
    if events is None:
        refuse("Provider audit table is missing.")
    return migrations, tables


def validate_django_plan():
    import django
    django.setup()
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor
    if connection.vendor != "postgresql":
        refuse("Django is not configured for Production PostgreSQL.")
    executor = MigrationExecutor(connection)
    steps = [(migration.app_label, migration.name, backwards)
             for migration, backwards in
             executor.migration_plan([("domains", "0002_dns_readonly_binding")])]
    if steps != [(app, name, False) for app, name in EXPECTED_PENDING]:
        refuse("The Django migration plan contains other, missing or reverse operations.")
    return steps


def main():
    if len(sys.argv) != 2 or sys.argv[1] != "plan":
        refuse("Only plan is supported. DNS-01 Production migration execution is NOT enabled.")
    if (os.getenv("OCTALVE_CLOUD_ENV") != "production" or
            os.getenv("DEBUG", "").lower() not in ("false", "0") or
            os.getenv("CI") or os.getenv("VERCEL") or os.getenv("GITHUB_ACTIONS")):
        refuse("Trusted local Production preflight required; CI/Vercel and DEBUG are refused.")
    url = checked_url()
    import psycopg
    with psycopg.connect(url, connect_timeout=15, autocommit=True) as db:
        if db.pgconn.ssl_in_use is not True:
            refuse("Database TLS was not negotiated.")
        before = inspect_db(db)
        steps = validate_django_plan()
        # Recheck after Django's separate read-only migration plan connection.
        if inspect_db(db) != before:
            refuse("Production migration ledger changed during preflight.")
    print("PASS: exact Production identity, active TLS and 62/115 baseline.")
    print("PASS: exactly one pending additive DNS-01 migration:")
    for app, name, _ in steps:
        print(" - " + app + "." + name)
    print("PLAN ONLY: no database records or schema were modified.")
    print("RELEASE HOLD: independent recoverable backup, tested restore, approved")
    print("migration executor and matching Vercel deployment still required.")


if __name__ == "__main__":
    main()
