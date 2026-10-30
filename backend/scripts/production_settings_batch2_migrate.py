"""One-off, fail-closed Production Django migration for Console Settings Batch 2.

Use ONLY via scripts/apply-neon-production-settings-batch2.ps1 on an
operator-controlled, encrypted Windows workstation. No Vercel/CI invocation.
Never print DB URLs, secrets, customer data or template contents.
"""
import hashlib
import os
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

# Run from a checked-out monorepo root without relying on the shell PYTHONPATH.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0,str(BACKEND_ROOT))
os.environ.setdefault("DJANGO_SETTINGS_MODULE","octalve_backend.settings")

HOST = "ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech"
DATABASE = "neondb"
ROLE = "neondb_owner"
EXPECTED_BEFORE = (55, 107)
EXPECTED_AFTER = (59, 111)
TARGET = ("settings_registry", "0005_tax_policy_revision")
EXPECTED_PENDING = [
    ("settings_registry", "0002_console_policy_defaults"),
    ("settings_registry", "0003_mail_template_outbox"),
    ("settings_registry", "0004_seed_mail_templates"),
    ("settings_registry", "0005_tax_policy_revision"),
]
NEW_TABLES = {
    "settings_registry_emailtemplaterevision",
    "settings_registry_consolemailoutbox",
    "settings_registry_consolemailattempt",
    "settings_registry_taxpolicyrevision",
}
EXPECTED_KEYS = {
    "welcome", "order_received", "payment_confirmed", "invoice_issued",
    "invoice_due", "invoice_overdue", "domain_expiry_month",
    "domain_expiry_week", "support_ticket", "hosting_ready",
    "seasonal_greeting", "promotion",
}

def refuse(reason):
    raise SystemExit("SETTINGS MIGRATION REFUSED: " + reason)

def target_url():
    raw = os.getenv("DATABASE_URL", "")
    try:
        url = urlsplit(raw)
        query = parse_qs(url.query)
        allowed = (
            url.scheme in ("postgres", "postgresql")
            and url.hostname == HOST
            and url.username == ROLE
            and url.password
            and url.path == "/" + DATABASE
            and url.port in (None, 5432)
            and query.get("sslmode") in (["require"], ["verify-full"])
            and not url.fragment
        )
    except (TypeError, ValueError):
        allowed = False
    if not allowed:
        refuse("Exact unpooled Neon Production endpoint, role, db and TLS are required.")
    return raw

def db_snapshot(connection):
    with connection.cursor() as cur:
        cur.execute("""SELECT current_database(),current_user,
            (SELECT COUNT(*) FROM public.django_migrations),
            (SELECT COUNT(*) FROM information_schema.tables
             WHERE table_schema='public' AND table_type='BASE TABLE')""")
        db, role, migration_count, table_count = cur.fetchone()
        cur.execute("SELECT app,name FROM public.django_migrations")
        migrations = set(cur.fetchall())
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        tables = {row[0] for row in cur.fetchall()}
    if (db, role) != (DATABASE, ROLE):
        refuse("Unexpected database or SQL identity.")
    return migration_count, table_count, migrations, tables

def validated_plan():
    import django
    django.setup()
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor
    executor = MigrationExecutor(connection)
    plan = executor.migration_plan([TARGET])
    steps = [(migration.app_label, migration.name) for migration, backward in plan]
    if any(backward for migration, backward in plan) or steps != EXPECTED_PENDING:
        refuse("The Django migration dependency plan is not EXACTLY four additive Settings migrations: " + repr(steps))
    return steps

def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("plan", "apply"):
        refuse("Specify plan or apply.")
    mode = sys.argv[1]
    if (os.environ.get("OCTALVE_CLOUD_ENV") != "production"
        or os.getenv("CI") or os.getenv("VERCEL") or os.getenv("GITHUB_ACTIONS")):
        refuse("Interactive local Production process required, CI/Vercel prohibited.")
    url = target_url()
    import psycopg
    with psycopg.connect(url,connect_timeout=15,sslmode="require") as conn:
        if conn.pgconn.ssl_in_use is not True:
            refuse("TLS is not active on the local-to-Neon session.")
        before = db_snapshot(conn)
        if before[:2] == EXPECTED_AFTER and all(x in before[2] for x in EXPECTED_PENDING):
            print("Already applied: 59 migrations and 111 tables. Refusing to repeat.")
            return
        if before[:2] != EXPECTED_BEFORE:
            refuse("Migration count/table count drift: expected 55/107, got %s/%s" % before[:2])
        if ("settings_registry","0001_initial") not in before[2] or any(
           item in before[2] for item in EXPECTED_PENDING):
            refuse("Unexpected Settings migration history.")
        if any(table in before[3] for table in NEW_TABLES):
            refuse("One or more intended new tables already exist.")
        if ("accounts","0003_auththrottlebucket") not in before[2]:
            refuse("Authentication security baseline not present.")
        plan = validated_plan()
        print("PASS: Exact target/role, TLS and existing ledger 55/107.")
        print("Django migration plan (no unrelated provider migrations):")
        for app,name in plan:
            print(" - "+app+"."+name)
        if mode == "plan":
            print("PLAN-ONLY PASS. No database writes attempted.")
            return
        if os.getenv("OCTALVE_SETTINGS_LOCAL_BACKUP_VERIFIED") != "true":
            refuse("Verified secure local pg_dump backup is required.")
        backup = Path(os.getenv("OCTALVE_SETTINGS_LOCAL_BACKUP_FILE",""))
        if not backup.is_file() or backup.stat().st_size < 10000:
            refuse("Missing verified local backup archive.")
        checksum = hashlib.sha256()
        with backup.open("rb") as handle:
            for chunk in iter(lambda:handle.read(1048576),b""):
                checksum.update(chunk)
        if checksum.hexdigest() != os.getenv("OCTALVE_SETTINGS_LOCAL_BACKUP_SHA256"):
            refuse("Local backup checksum mismatch.")
        phrase = input("Type APPLY SETTINGS 0002-0005 TO OCTALVE PRODUCTION: ")
        if phrase != "APPLY SETTINGS 0002-0005 TO OCTALVE PRODUCTION":
            refuse("Exact owner approval phrase missing.")
        # Hold an exclusive session lock outside the Django connection.
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_lock(hashtext('octalve_settings_batch2_migration'))")
        try:
            current=db_snapshot(conn)
            if current[:2]!=EXPECTED_BEFORE or current[2]!=before[2]:
                refuse("Database ledger changed during backup; no changes attempted.")
            from django.core.management import call_command
            call_command("migrate","settings_registry","0005",interactive=False,verbosity=1)
            with psycopg.connect(url,connect_timeout=15,sslmode="require") as verify:
                final=db_snapshot(verify)
                if final[:2]!=EXPECTED_AFTER or not NEW_TABLES.issubset(final[3]) or not all(
                    item in final[2] for item in EXPECTED_PENDING):
                    refuse("POSTFLIGHT FAILED: stop, investigate and keep the application on the previous release.")
                with verify.cursor() as cur:
                    cur.execute("SELECT key FROM settings_registry_emailtemplate WHERE key=ANY(%s)",(list(EXPECTED_KEYS),))
                    seeded={row[0] for row in cur.fetchall()}
                if not EXPECTED_KEYS.issubset(seeded):
                    refuse("POSTFLIGHT FAILED: seeded email template keys missing.")
            print("PASS: Four actual Django migrations applied, 59/111 ledger and expected inactive-template seed present.")
            print("Backup retained on operator workstation. Do not upload archive or database credentials.")
        finally:
            with conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_unlock(hashtext('octalve_settings_batch2_migration'))")

if __name__ == "__main__":
    main()
