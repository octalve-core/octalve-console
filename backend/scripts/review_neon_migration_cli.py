"""Explicitly approved first Django schema migration to isolated Neon Preview.

This is a one-off CLI command, never an HTTP handler, CI build, production
deployment hook or cron. Credentials are inherited from Vercel's scoped
Preview environment directly in memory. Never print database URLs or tokens.
"""
import hashlib
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

import psycopg

EXPECTED_HOST = "ep-damp-morning-b8ll84zq.c-14.us-east-1.aws.neon.tech"
EXPECTED_DATABASE = "neondb"
EXPECTED_ROLE = "neondb_owner"
EXPECTED_PLAN_SHA256 = "80b1813003a779ffb314085caec5402cafb7cc96dd87cb1c7cbde1f154e57a20"
EXPECTED_MIGRATIONS = 36
EXPECTED_OPERATIONS = 200

# Only a single proven display difference in Django's built-in auth.0011
# RunPython docstring. The actual operation and every other plan line match.
APPROVED_DESCRIPTION_LINE = "    Raw Python operation ->     Update the content_type of prox…"
ALTERNATE_DESCRIPTION_LINE = "    Raw Python operation -> Update the content_type of proxy mo…"
EXPECTED_ALTERNATE_PLAN_SHA256 = "c2aea600e8252ea7e8f479268a0eb36f64297b2f3d57495b071f5d74571a5656"

def fail(message):
    raise SystemExit("Migration REFUSED: " + message)

def check_connection_identity(conn):
    # Neon terminates TLS at its connection proxy. The PostgreSQL backend's
    # pg_stat_ssl view may report false even for an encrypted client connection.
    # Ask libpq (through psycopg3), which reports the client's actual TLS state.
    if conn.pgconn.ssl_in_use is not True:
        fail("TLS is not active on the client-to-Neon connection")
    with conn.cursor() as cur:
        cur.execute(
            """SELECT current_database(), current_user,
                (SELECT count(*) FROM information_schema.tables
                 WHERE table_schema='public' AND table_type='BASE TABLE'),
                to_regclass('public.django_migrations')::text"""
        )
        name, role, table_count, ledger = cur.fetchone()
    if name != EXPECTED_DATABASE or role != EXPECTED_ROLE:
        fail("PostgreSQL database or role does not match approved Foundation Preview")
    if table_count != 0 or ledger is not None:
        fail("nonempty schema; this initial-migration command must not be rerun")
    print("PASS: exact Neon Foundation Preview host and neondb; client TLS enabled; 0 tables.")

def capture_django_plan(backend, env):
    """Capture deterministic, Unicode-safe Django plan text on Linux/Windows."""
    plan_env = env.copy()
    # Windows redirected Python stdout can inherit the active ANSI code page.
    # Force the child to emit UTF-8 and explicitly decode UTF-8 on the parent.
    # Only the captured operation list is hashed, never a DB secret.
    plan_env["PYTHONIOENCODING"] = "utf-8"
    plan = subprocess.run(
        [sys.executable, "manage.py", "migrate", "--plan"],
        cwd=backend, env=plan_env, capture_output=True,
        encoding="utf-8", errors="strict", timeout=120,
    )
    if plan.returncode:
        fail("Django migration planning failed; exit code " + str(plan.returncode))
    return plan


def verify_reviewed_plan(stdout, repo_root):
    """Reject altered plans; the dated GitHub document is the locked authority."""
    from itertools import zip_longest

    doc_path = repo_root / "docs" / "CLOUD_FOUNDATION_NEON_INITIAL_MIGRATION_PLAN_2026-10-23.md"
    doc = doc_path.read_text(encoding="utf-8")
    doc = doc.replace("\r\n", "\n")
    marker = "```text\n"
    start = doc.find(marker)
    end = doc.find("\n```", start + len(marker))
    if start == -1 or end == -1:
        fail("approved migration transcript is missing")
    reference = doc[start + len(marker):end] + "\n"
    reference_digest = hashlib.sha256(reference.encode("utf-8")).hexdigest()
    if reference_digest != EXPECTED_PLAN_SHA256:
        fail("approved migration transcript differs from its locked fingerprint")

    # Reconstruct precisely the one display-only line variation independently
    # proven from the Windows output, not a blanket whitespace normalization.
    approved_line = APPROVED_DESCRIPTION_LINE + "\n"
    if reference.count(approved_line) != 1:
        fail("approved auth.0011 migration description not found exactly once")
    alternate = reference.replace(
        approved_line, ALTERNATE_DESCRIPTION_LINE + "\n", 1
    )
    if hashlib.sha256(alternate.encode("utf-8")).hexdigest() != EXPECTED_ALTERNATE_PLAN_SHA256:
        fail("locked alternate migration transcript fingerprint is incorrect")

    digest = hashlib.sha256(stdout.encode("utf-8")).hexdigest()
    migrations = [line for line in stdout.splitlines()
                  if line and not line.startswith(" ") and line != "Planned operations:"]
    operations = [line for line in stdout.splitlines() if line.startswith("    ")]
    print("Django plan:", len(migrations), "migrations;", len(operations), "operations.")
    matching_approved = stdout == reference and digest == EXPECTED_PLAN_SHA256
    matching_display_variant = stdout == alternate and digest == EXPECTED_ALTERNATE_PLAN_SHA256
    if (not (matching_approved or matching_display_variant)
            or len(migrations) != EXPECTED_MIGRATIONS
            or len(operations) != EXPECTED_OPERATIONS):
        print("Migration transcript SHA-256 (observed):", digest)
        print("Migration transcript SHA-256 (approved):", EXPECTED_PLAN_SHA256)
        for index, (expected_line, actual_line) in enumerate(
            zip_longest(reference.splitlines(), stdout.splitlines(), fillvalue="<end>"), 1
        ):
            if expected_line != actual_line:
                # Migration operation labels only, never database credentials.
                print("First differing Django plan line:", index)
                print("Approved:", repr(expected_line[:180]))
                print("Observed:", repr(actual_line[:180]))
                break
        fail("plan differs from locked reviewed migrations / 36 migrations / 200 operations")
    if matching_display_variant:
        print("PASS: only verified auth.0011 description whitespace/truncation differs.")
        print("PASS: every other plan byte matches original approved transcript.")
    else:
        print("PASS: complete plan matches the original approved transcript.")
    print("PASS: approved plan authority SHA-256", EXPECTED_PLAN_SHA256)


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("plan", "apply"):
        fail("usage: review_neon_migration_cli.py plan|apply")
    action = sys.argv[1]
    direct_url = os.getenv("DATABASE_URL_UNPOOLED", "")
    if not direct_url:
        fail("Vercel Preview DATABASE_URL_UNPOOLED is missing. Do not paste secrets.")
    p = urlsplit(direct_url)
    if p.scheme not in ("postgresql", "postgres") or p.hostname != EXPECTED_HOST:
        fail("database host is NOT the specifically approved Foundation Preview endpoint")
    if p.path.lstrip("/") != EXPECTED_DATABASE:
        fail("unexpected database name")
    if p.username != EXPECTED_ROLE:
        fail("unexpected database role")
    if os.getenv("OCTALVE_CLOUD_ENV") != "review":
        fail("OCTALVE_CLOUD_ENV must be 'review'")
    if os.getenv("VERCEL_ENV") != "preview":
        fail("VERCEL_ENV must be 'preview'")

    with psycopg.connect(direct_url, sslmode="require", connect_timeout=12) as conn:
        check_connection_identity(conn)

    repo_root = Path(__file__).resolve().parents[2]
    backend = repo_root / "backend"
    env = os.environ.copy()
    env["DATABASE_URL"] = direct_url
    env["DEBUG"] = "false"
    env.setdefault("DJANGO_SECRET_KEY", "local-cli-only-migration-key-not-for-runtime")
    plan = capture_django_plan(backend, env)
    verify_reviewed_plan(plan.stdout, repo_root)
    if action == "plan":
        print("PLAN ONLY: no schema modifications made.")
        return

    if os.getenv("OCTALVE_APPROVE_FOUNDATION_SCHEMA") != "APPLY 36 MIGRATIONS TO FOUNDATION PREVIEW":
        fail("explicit typed approval phrase missing")
    print("Applying initial Django schema to approved Neon Foundation Preview ONLY.")
    result = subprocess.run(
        [sys.executable, "manage.py", "migrate", "--noinput"],
        cwd=backend, env=env, text=True, timeout=400,
    )
    if result.returncode:
        fail("Django migrate failed; inspect and reconcile the exact database state before retry")
    with psycopg.connect(direct_url, sslmode="require", connect_timeout=12) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM django_migrations")
            applied = cur.fetchone()[0]
            cur.execute(
                "SELECT count(*) FROM information_schema.tables "
                "WHERE table_schema='public' AND table_type='BASE TABLE'"
            )
            tables = cur.fetchone()[0]
    if applied != EXPECTED_MIGRATIONS or tables <= 0:
        fail("migration result requires manual verification before further operations")
    print("PASS: exactly", applied, "Django migrations recorded;", tables, "public tables.")

if __name__ == "__main__":
    main()
