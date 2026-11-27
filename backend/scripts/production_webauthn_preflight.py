"""AUTH-02: guarded local WebAuthn migration. Never execute from CI or Vercel."""
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
EXPECTED_BEFORE = (64, 117)
EXPECTED_AFTER = (66, 120)
TARGET = ("accounts", "0005_privileged_passkey_enrollment")
TARGETS = (("accounts", "0004_privileged_webauthn"), TARGET)
PLAN = [(app, name, False) for app, name in TARGETS]
TABLES = ("accounts_privilegedloginchallenge", "accounts_privilegedpasskey", "accounts_privilegedpasskeygrant")
LOCK = "octalve_production_webauthn_migrations_0004_0005"


def refuse(reason):
    raise SystemExit("AUTH-02 MIGRATION REFUSED: " + reason)


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
            and set(params).issubset({"sslmode", "channel_binding"})
            and params.get("channel_binding", ["require"]) in (["require"], ["prefer"])
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


def ledger_digest(ledger):
    return hashlib.sha256("\n".join(f"{app}:{name}" for app, name in sorted(ledger)).encode()).hexdigest()


def database_state(conn):
    with conn.cursor() as cur:
        cur.execute("""SELECT current_database(), current_user,
            (SELECT COUNT(*) FROM public.django_migrations),
            (SELECT COUNT(*) FROM pg_catalog.pg_tables WHERE schemaname='public')""")
        db_name, role, migration_count, table_count = cur.fetchone()
        cur.execute("SELECT app,name FROM public.django_migrations")
        ledger = frozenset(cur.fetchall())
        cur.execute("SELECT to_regclass('public.accounts_privilegedloginchallenge'), "
                    "to_regclass('public.accounts_privilegedpasskey'), "
                    "to_regclass('public.accounts_privilegedpasskeygrant')")
        tables = cur.fetchone()
    if db_name != EXPECTED_DATABASE or role != EXPECTED_ROLE or len(ledger) != migration_count:
        refuse("Connected database, role or migration ledger is invalid.")
    if ("accounts", "0003_auththrottlebucket") not in ledger:
        refuse("Required auth throttle migration is absent.")
    if (migration_count, table_count) == EXPECTED_BEFORE and not set(TARGETS).intersection(ledger) and not any(tables):
        return "before", ledger
    if (migration_count, table_count) == EXPECTED_AFTER and set(TARGETS).issubset(ledger) and all(tables):
        return "after", ledger
    refuse("Production schema/ledger differs from exact 64/117 before or 66/120 after states; partial state requires review.")


def validated_plan():
    import django
    django.setup()
    from django.conf import settings
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor
    from django.db.migrations.operations.models import CreateModel
    if settings.CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED or settings.CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED:
        refuse("Local WebAuthn flags must both be disabled.")
    if (connection.vendor != "postgresql" or
            connection.settings_dict.get("NAME") != EXPECTED_DATABASE or
            connection.settings_dict.get("USER") != EXPECTED_ROLE or
            connection.settings_dict.get("HOST") != EXPECTED_HOST):
        refuse("Django connection does not match the reviewed direct Neon target.")
    executor = MigrationExecutor(connection)
    for target, names in zip(TARGETS, (["PrivilegedLoginChallenge", "PrivilegedPasskey"], ["PrivilegedPasskeyGrant"])):
        migration = executor.loader.disk_migrations.get(target)
        if migration is None or not migration.atomic or [type(op) for op in migration.operations] != [CreateModel] * len(names) or [op.name for op in migration.operations] != names:
            refuse("Reviewed additive migration operations changed.")
    executor.loader.check_consistent_history(connection)
    actual = set(executor.loader.applied_migrations)
    graph = set(executor.loader.graph.nodes)
    if actual not in (graph - set(TARGETS), graph):
        refuse("Exact full Django migration graph and applied ledger do not match the reviewed baseline.")
    plan = [(m.app_label, m.name, backwards) for m, backwards in executor.migration_plan(executor.loader.graph.leaf_nodes())]
    if plan not in (PLAN, []):
        refuse("Unexpected unrelated, missing or reverse migration operations.")
    return plan


def verify_backup_and_restore():
    if (os.environ.get("OCTALVE_WEBAUTHN_BACKUP_VERIFIED") != "true"
            or os.environ.get("OCTALVE_WEBAUTHN_RESTORE_VERIFIED") != "true"):
        refuse("Fresh encrypted backup and completed independent local restore are required.")
    file_value = os.environ.get("OCTALVE_WEBAUTHN_BACKUP_FILE", "")
    digest = os.environ.get("OCTALVE_WEBAUTHN_BACKUP_SHA256", "")
    restored_digest = os.environ.get("OCTALVE_WEBAUTHN_RESTORE_SHA256", "")
    proof_time = os.environ.get("OCTALVE_WEBAUTHN_RESTORE_AT", "")
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


def verify_webauthn_postflight(conn, *, require_empty=False):
    state, _ = database_state(conn)
    if state != "after":
        refuse("Postflight requires exactly 66 migrations and 120 tables.")
    columns = {
        TABLES[0]: {"id", "challenge", "expires_at", "used_at", "user_id"},
        TABLES[1]: {"id", "credential_id", "public_key", "sign_count", "created_at", "revoked_at", "user_id"},
        TABLES[2]: {"digest", "approval_reference", "recovery", "challenge", "created_at", "expires_at", "used_at", "user_id"},
    }
    primary = dict(zip(TABLES, ("id", "id", "digest")))
    with conn.cursor() as cur:
        for table in TABLES:
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=%s", (table,))
            if {row[0] for row in cur.fetchall()} != columns[table]:
                refuse("Unexpected WebAuthn table column set.")
            cur.execute("""SELECT contype, pg_get_constraintdef(oid) FROM pg_constraint
                           WHERE conrelid=to_regclass(%s)""", ("public."+table,))
            constraints = cur.fetchall()
            if not any(kind == "p" and f"({primary[table]})" in definition for kind, definition in constraints):
                refuse("WebAuthn primary key missing.")
            if not any(kind == "f" and "(user_id)" in definition and "accounts_customuser(id)" in definition for kind, definition in constraints):
                refuse("WebAuthn account foreign key missing.")
            if table == TABLES[1] and not any(kind == "u" and "(credential_id)" in definition for kind, definition in constraints):
                refuse("Unique WebAuthn credential constraint missing.")
            if table == TABLES[1] and not any(kind == "c" and "sign_count" in definition for kind, definition in constraints):
                refuse("Passkey counter constraint missing.")
            cur.execute("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=%s", (table,))
            indexes = [row[0] for row in cur.fetchall()]
            if not any("(user_id)" in item for item in indexes) or (table != TABLES[1] and not any("(expires_at)" in item for item in indexes)):
                refuse("Required WebAuthn indexes missing.")
            if require_empty:
                # Identifier comes solely from the fixed reviewed TABLES tuple.
                cur.execute(f"SELECT count(*) FROM public.{table}")
                if cur.fetchone()[0] != 0:
                    refuse("Unexpected WebAuthn records before enrollment activation.")


def _direct_connection(raw_url):
    """A new direct, TLS-verified connection, never a pooled Neon session."""
    import psycopg
    conn = psycopg.connect(raw_url, connect_timeout=15, autocommit=True)
    if conn.pgconn.ssl_in_use is not True:
        conn.close()
        refuse("The Production PostgreSQL connection is not encrypted.")
    return conn


def _lock_release(conn):
    """Do not conceal the original exception if Neon closed the session.

    A terminated PostgreSQL session automatically loses all of its session
    advisory locks. Attempt unlock only while the connection is usable.
    """
    if conn is None or conn.closed:
        return
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_unlock(hashtext(%s))", (LOCK,))
            if cur.fetchone()[0] is not True:
                print("WARNING: migration lock was no longer held by this session.",
                      file=sys.stderr)
    except Exception:
        # A server-forced disconnect invalidates the connection and releases
        # its advisory lock. Nothing may retry or mask a migration failure.
        print("WARNING: migration session ended before lock cleanup; "
              "verify the database ledger before any further action.",
              file=sys.stderr)


def _locked_fresh_session(raw_url, expected_ledger):
    """Bounded, read-only reconnection BEFORE any schema command.

    This is safe to retry once because no migration operation has started.
    We never automatically retry after call_command('migrate') begins.
    """
    import psycopg
    for attempt in range(2):
        conn = None
        locked = False
        verified = False
        try:
            conn = _direct_connection(raw_url)
            with conn.cursor() as cur:
                cur.execute("SELECT pg_try_advisory_lock(hashtext(%s))", (LOCK,))
                locked = cur.fetchone()[0] is True
            if not locked:
                refuse("Another AUTH-02 release process holds the migration lock.")
            state, ledger = database_state(conn)
            if state != "before" or ledger != expected_ledger:
                refuse("Migration state changed since preflight. No schema change was attempted.")
            if validated_plan() != PLAN:
                refuse("Migration plan changed since preflight. No schema change was attempted.")
            # The advisory lock is session-scoped; a server restart while
            # Django rechecked the plan would release it. Prove that this exact
            # locked connection is still usable immediately before DDL.
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                if cur.fetchone() != (1,):
                    refuse("Locked database session failed final health verification.")
            verified = True
            return conn
        except (psycopg.OperationalError, psycopg.InterfaceError):
            if attempt == 1:
                raise
            print("A Neon session ended during read-only release validation. "
                  "Opening one fresh verified session before any schema write.",
                  file=sys.stderr)
        finally:
            # On success, ownership transfers to the caller.
            if conn is not None and not verified:
                if locked:
                    _lock_release(conn)
                conn.close()
    refuse("Could not verify a fresh Neon migration session.")


def _readback_after_migration(raw_url):
    """Independent postflight queries only: never run the migration twice."""
    import psycopg
    for attempt in range(2):
        conn = None
        try:
            conn = _direct_connection(raw_url)
            verify_webauthn_postflight(conn, require_empty=True)
            return
        except (psycopg.OperationalError, psycopg.InterfaceError):
            if attempt == 1:
                raise
            print("Neon disconnected during read-only postflight; "
                  "reconnecting once without rerunning any migration.",
                  file=sys.stderr)
        finally:
            if conn is not None:
                conn.close()


def _close_django_connections():
    """Close only Django's independent connections before/after operator input."""
    from django.db import connections
    connections.close_all()


def _migrate_target_once():
    """The sole schema operation, deliberately isolated for negative tests."""
    from django.core.management import call_command
    from django.db import transaction
    # Both additive migrations are applied within one outer PostgreSQL transaction.
    # A failed second migration must not leave a partially applied schema.
    with transaction.atomic():
        call_command("migrate", TARGET[0], TARGET[1],
                     interactive=False, verbosity=1)


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("plan", "apply"):
        refuse("Specify only plan or apply.")
    action = sys.argv[1]
    runtime_guard()
    raw_url = checked_url()
    if action == "apply":
        verify_backup_and_restore()
        if os.environ.get("OCTALVE_WEBAUTHN_SOURCE_APPROVED") != "true":
            refuse("The checked-out and CI-reviewed main commit has not been attested by the operator.")

    # Step 1: READ-ONLY preflight, with no long-lived session lock.
    # Close this session BEFORE waiting for human input. Neon can terminate an
    # idle compute while the operator reads and types the approval phrase.
    with _direct_connection(raw_url) as preflight:
        prior, ledger = database_state(preflight)
        plan = validated_plan()
        if prior == "after":
            if plan:
                refuse("Migration ledger is applied but Django still shows it pending.")
            verify_webauthn_postflight(preflight)
            print("AUTH-02 ALREADY APPLIED: qualified 66/120. No migration rerun.")
            return
        if plan != PLAN:
            refuse("Django did not produce the two authorized additive WebAuthn migrations.")
        if action == "plan":
            print("PREFLIGHT PASS: exact Production Neon host, TLS, 64 migrations/117 tables.")
            print("PREFLIGHT PASS: precisely accounts.0004_privileged_webauthn and accounts.0005_privileged_passkey_enrollment are pending.")
            print("BASELINE LEDGER SHA256:", ledger_digest(ledger))
            print("PLAN ONLY: no Production schema or customer records modified.")
            return

    if os.environ.get("OCTALVE_WEBAUTHN_LEDGER_SHA256") != ledger_digest(ledger):
        refuse("Restored backup ledger differs from current Production.")
    # Step 2: The operator's decision must not leave a Neon session idle.
    _close_django_connections()
    phrase = input("Type APPLY WEBAUTHN 0004 0005 TO OCTALVE PRODUCTION: ")
    if phrase != "APPLY WEBAUTHN 0004 0005 TO OCTALVE PRODUCTION":
        refuse("Exact operator approval phrase missing; no database changes attempted.")
    # A long pause during operator approval must never make an older restore
    # receipt valid for a later schema change. Check the same protected archive
    # again before opening any write-authorized database session.
    verify_backup_and_restore()

    # Step 3: NEW, locked and independently revalidated connection after
    # approval; one bounded retry is allowed only while still read-only.
    conn = _locked_fresh_session(raw_url, ledger)
    try:
        # Django's migration executor uses its own connection. Force a fresh
        # one after the human approval to avoid any earlier idle/closed session.
        _close_django_connections()
        try:
            _migrate_target_once()
        except Exception:
            print("MIGRATION OUTCOME UNCERTAIN: no automatic retry. "
                  "Independently inspect the exact ledger/schema and "
                  "retain the verified backup.", file=sys.stderr)
            raise

        # Step 4: Query through a NEW independent TLS session; never rely on
        # the lock-holder or attempt another schema operation during readback.
        _readback_after_migration(raw_url)
        print("AUTH-02 APPLY PASS: 66 migrations, 120 tables, three empty WebAuthn tables, constraints and indexes verified.")
        print("NOTE: No feature flags changed; enrollment and enforcement remain separately gated.")
    finally:
        _lock_release(conn)
        conn.close()


if __name__ == "__main__":
    main()
