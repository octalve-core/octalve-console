"""DNS-01C: fail-closed local Production migration runner (plan | apply).

The prior reviewed Settings Batch 2 runner established the operator-only pattern:
clean main -> exact Neon identity -> single Django plan -> fresh backup and
isolated restore -> typed approval -> guarded Django migrate -> postflight.
Only this DNS-01C migration may be applied. Never call this script from Vercel,
GitHub Actions or a web route; never echo database URLs or domain records.
"""
import hashlib
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "octalve_backend.settings")

EXPECTED_HOST = "ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech"
EXPECTED_DATABASE = "neondb"
EXPECTED_ROLE = "neondb_owner"
EXPECTED_BEFORE = (63, 116)
EXPECTED_AFTER = (64, 117)
TARGET = ("domains", "0003_external_dns_claims")
TABLE = "domains_domaindnsclaim"
LOCK = "octalve_production_dns01c_migration_0003"


def refuse(reason):
    raise SystemExit("DNS-01C MIGRATION REFUSED: " + reason)


def checked_url():
    raw = os.environ.get("DATABASE_URL", "")
    try:
        parsed = urlsplit(raw)
        params = parse_qs(parsed.query)
        permitted = (
            parsed.scheme in ("postgres", "postgresql")
            and parsed.hostname == EXPECTED_HOST
            and parsed.username == EXPECTED_ROLE
            and bool(parsed.password)
            and parsed.path == "/" + EXPECTED_DATABASE
            and parsed.port in (None, 5432)
            and params.get("sslmode") in (["require"], ["verify-full"])
            and not parsed.fragment
            and not parsed.hostname.endswith("-pooler.c-14.us-east-1.aws.neon.tech")
        )
    except (TypeError, ValueError):
        permitted = False
    if not permitted:
        refuse("Exact direct Neon Production host, database, role and TLS are mandatory.")
    return raw


def runtime_guard():
    if (os.environ.get("OCTALVE_CLOUD_ENV") != "production"
            or os.environ.get("DEBUG", "").lower() not in ("false", "0")
            or any(os.environ.get(name) for name in (
                "CI", "GITHUB_ACTIONS", "VERCEL", "VERCEL_ENV", "VERCEL_URL"
            ))):
        refuse("Only an interactive trusted Production workstation may run this script.")


def database_state(conn):
    with conn.cursor() as cur:
        cur.execute("""SELECT current_database(), current_user,
            (SELECT COUNT(*) FROM public.django_migrations),
            (SELECT COUNT(*) FROM pg_catalog.pg_tables WHERE schemaname='public')""")
        db_name, role, migration_count, table_count = cur.fetchone()
        cur.execute("SELECT app,name FROM public.django_migrations")
        ledger = frozenset(cur.fetchall())
        cur.execute("""SELECT to_regclass('public.domains_domaindnsclaim'),
                              to_regclass('public.domains_domaindnsbinding'),
                              to_regclass('public.providers_integrationconnectionevent')""")
        dns_table, dns_binding_table, provider_audit_table = cur.fetchone()
    if db_name != EXPECTED_DATABASE or role != EXPECTED_ROLE:
        refuse("Connected database or role differs from the approved Neon Production target.")
    required = {
        ("domains", "0001_initial"),
        ("domains", "0002_dns_readonly_binding"),
        ("providers", "0002_integration_draft_vault"),
        ("providers", "0003_provider_vault_authenticator"),
        ("providers", "0004_provider_event_integrity"),
    }
    if (provider_audit_table is None or dns_binding_table is None
            or not required.issubset(ledger)):
        refuse("Mandatory domain and provider audit prerequisites are missing.")
    present = TARGET in ledger
    if (migration_count, table_count) == EXPECTED_BEFORE and not present and dns_table is None:
        return ("before", ledger)
    if (migration_count, table_count) == EXPECTED_AFTER and present and dns_table is not None:
        return ("after", ledger)
    refuse("Production schema/ledger differs from exact 63/116 before or 64/117 after states.")


def validated_plan():
    import django
    django.setup()
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor
    from django.db.migrations.operations.models import (
        AddField, AlterField, AddConstraint, CreateModel, AddIndex,
    )
    if (connection.vendor != "postgresql" or
            connection.settings_dict.get("NAME") != EXPECTED_DATABASE or
            connection.settings_dict.get("USER") != EXPECTED_ROLE or
            connection.settings_dict.get("HOST") != EXPECTED_HOST):
        refuse("Django's connection differs from the independently verified Neon Production target.")
    executor = MigrationExecutor(connection)
    migration = executor.loader.disk_migrations.get(TARGET)
    if migration is None:
        refuse("Reviewed external DNS claim migration is missing.")
    expected = [AddField, AlterField, AlterField, AlterField,
                AlterField, AlterField, AddConstraint, CreateModel,
                AddIndex, AddIndex]
    if ([type(op) for op in migration.operations] != expected or
            migration.operations[0].name != "management_kind" or
            migration.operations[7].name != "DomainDNSClaim"):
        refuse("DNS-01C migration operations changed; review again.")
    plans = [(m.app_label, m.name, backwards)
             for m, backwards in executor.migration_plan([TARGET])]
    if plans not in ([(TARGET[0], TARGET[1], False)], []):
        refuse("Migration plan includes unexpected unrelated, missing or reverse operations.")
    return plans


def verify_backup_and_restore():
    if (os.environ.get("OCTALVE_DNS01C_BACKUP_VERIFIED") != "true"
            or os.environ.get("OCTALVE_DNS01C_RESTORE_VERIFIED") != "true"):
        refuse("Fresh encrypted backup and completed independent local restore are required.")
    file_value = os.environ.get("OCTALVE_DNS01C_BACKUP_FILE", "")
    digest = os.environ.get("OCTALVE_DNS01C_BACKUP_SHA256", "")
    restored_digest = os.environ.get("OCTALVE_DNS01C_RESTORE_SHA256", "")
    proof_time = os.environ.get("OCTALVE_DNS01C_RESTORE_AT", "")
    if not file_value or not re.fullmatch(r"[0-9a-f]{64}", digest):
        refuse("Verified backup filename or SHA-256 is missing.")
    if digest != restored_digest:
        refuse("Restored archive digest differs from protected backup digest.")
    try:
        timestamp = datetime.fromisoformat(proof_time)
        moment = datetime.now(timezone.utc)
        fresh = (timestamp.tzinfo is not None and
                 timedelta(0) <= moment - timestamp.astimezone(timezone.utc) <= timedelta(hours=2))
    except (ValueError, TypeError, OverflowError):
        fresh = False
    if not fresh:
        refuse("Restore qualification was not completed in this release window.")
    archive = Path(file_value)
    if not archive.is_file() or archive.stat().st_size < 10000:
        refuse("Fresh custom-format PostgreSQL archive is absent or unexpectedly small.")
    h = hashlib.sha256()
    with archive.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    if h.hexdigest() != digest:
        refuse("Protected backup file no longer matches its SHA-256.")
    return digest


def verify_dns_postflight(conn, *, require_empty=False):
    state, _ = database_state(conn)
    if state != "after":
        refuse("DNS-01C postflight must be exactly 64 migrations and 117 tables.")
    with conn.cursor() as cur:
        cur.execute("""SELECT column_name FROM information_schema.columns
                       WHERE table_schema='public' AND table_name=%s""", (TABLE,))
        columns = {row[0] for row in cur.fetchall()}
        cur.execute("""SELECT count(*) FROM pg_constraint
                       WHERE conrelid = 'public.domains_domaindnsclaim'::regclass
                             AND contype='f'""")
        foreign_keys = cur.fetchone()[0]
        cur.execute("""SELECT indexname FROM pg_indexes
                       WHERE schemaname='public' AND tablename=%s""", (TABLE,))
        indexes = {row[0] for row in cur.fetchall()}
        cur.execute("""SELECT count(*) FROM pg_constraint
                       WHERE conname='dns_only_requires_no_registrar_claim'
                       AND conrelid='public.domains_domain'::regclass""")
        domain_constraint = cur.fetchone()[0]
        cur.execute("""SELECT column_name,is_nullable FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='domains_domain'
                         AND column_name IN
                             ('registration_date','expiry_date','next_due_date',
                              'management_kind')""")
        domain_fields = dict(cur.fetchall())
        cur.execute("SELECT count(*) FROM public.domains_domaindnsclaim")
        claims = cur.fetchone()[0]
    required = {"id", "domain_name", "client_id", "challenge_sha256",
                "expires_at", "state", "domain_id", "verified_by_id",
                "verified_at", "created_at", "updated_at"}
    if (not required.issubset(columns) or foreign_keys < 3 or
            not {"dns_claim_owner_state_idx", "dns_claim_expiry_idx"}.issubset(indexes) or
            domain_constraint != 1 or domain_fields != {
                "registration_date": "YES", "expiry_date": "YES",
                "next_due_date": "YES", "management_kind": "NO",
            } or (require_empty and claims != 0)):
        refuse("DNS-01C claim schema, indices, registrar-truth constraint or initial state is invalid.")


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("plan", "apply"):
        refuse("Specify only plan or apply.")
    action = sys.argv[1]
    runtime_guard()
    raw_url = checked_url()
    if action == "apply":
        verify_backup_and_restore()
        if os.environ.get("OCTALVE_DNS01C_SOURCE_APPROVED") != "true":
            refuse("The checked-out and CI-reviewed main commit has not been attested by the operator.")
    import psycopg
    with psycopg.connect(raw_url, connect_timeout=15, autocommit=True) as conn:
        if conn.pgconn.ssl_in_use is not True:
            refuse("The Production PostgreSQL connection is not encrypted.")
        # No advisory lock needed for read-only planning. Acquire it before apply.
        if action == "apply":
            with conn.cursor() as cur:
                cur.execute("SELECT pg_try_advisory_lock(hashtext(%s))", (LOCK,))
                if cur.fetchone()[0] is not True:
                    refuse("Another DNS-01C release process holds the migration lock.")
        try:
            prior, ledger = database_state(conn)
            plan = validated_plan()
            if prior == "after":
                if plan:
                    refuse("Migration ledger is applied but Django still shows it pending.")
                verify_dns_postflight(conn)
                print("DNS-01C ALREADY APPLIED: qualified 64/117. No migration rerun.")
                return
            if plan != [(TARGET[0], TARGET[1], False)]:
                refuse("Django did not produce the one authorized additive DNS-01C migration.")
            if action == "plan":
                print("PREFLIGHT PASS: exact Production Neon host, TLS, 63 migrations/116 tables.")
                print("PREFLIGHT PASS: precisely domains.0003_external_dns_claims is pending.")
                print("PLAN ONLY: no Production schema or customer records modified.")
                return
            phrase = input("Type APPLY DNS01C 0002 TO OCTALVE PRODUCTION: ")
            if phrase != "APPLY DNS01C 0002 TO OCTALVE PRODUCTION":
                refuse("Exact operator approval phrase missing; no database changes attempted.")
            current, current_ledger = database_state(conn)
            if current != "before" or current_ledger != ledger:
                refuse("Migration ledger changed since the initial exact preflight.")
            # Django owns transaction boundaries for the reviewed migration.
            from django.core.management import call_command
            call_command("migrate", TARGET[0], TARGET[1], interactive=False, verbosity=1)
            verify_dns_postflight(conn, require_empty=True)
            print("DNS-01C APPLY PASS: new claim table, exact foreign keys,")
            print("indices, no pending claims, constraint and 64/117 ledger qualified.")
            print("NOTE: The DNS-01C read-only feature flag remains default disabled.")
        finally:
            if action == "apply":
                with conn.cursor() as cur:
                    cur.execute("SELECT pg_advisory_unlock(hashtext(%s))", (LOCK,))


if __name__ == "__main__":
    main()
