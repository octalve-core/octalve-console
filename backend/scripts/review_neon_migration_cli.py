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

def fail(message):
    raise SystemExit("Migration REFUSED: " + message)

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
        with conn.cursor() as cur:
            cur.execute(
                """SELECT current_database(), current_user,
                    (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()),
                    (SELECT count(*) FROM information_schema.tables
                     WHERE table_schema='public' AND table_type='BASE TABLE'),
                    to_regclass('public.django_migrations')::text"""
            )
            name, role, tls, table_count, ledger = cur.fetchone()
    if name != EXPECTED_DATABASE or role != EXPECTED_ROLE or tls is not True:
        fail("PostgreSQL identity or TLS check failed")
    if table_count != 0 or ledger is not None:
        fail("nonempty schema; this initial-migration command must not be rerun")
    print("PASS: exact Neon Foundation Preview host and neondb; TLS enabled; 0 tables.")

    repo_root = Path(__file__).resolve().parents[2]
    backend = repo_root / "backend"
    env = os.environ.copy()
    env["DATABASE_URL"] = direct_url
    env["DEBUG"] = "false"
    env.setdefault("DJANGO_SECRET_KEY", "local-cli-only-migration-key-not-for-runtime")
    plan = subprocess.run(
        [sys.executable, "manage.py", "migrate", "--plan"],
        cwd=backend, env=env, capture_output=True, text=True, timeout=120
    )
    if plan.returncode:
        fail("Django migration planning failed: " + plan.stderr[-1400:])
    digest = hashlib.sha256(plan.stdout.encode()).hexdigest()
    migrations = [x for x in plan.stdout.splitlines()
                  if x and not x.startswith(" ") and x != "Planned operations:"]
    operations = [x for x in plan.stdout.splitlines() if x.startswith("    ")]
    print("Django plan:", len(migrations), "migrations;", len(operations), "operations.")
    if (digest != EXPECTED_PLAN_SHA256 or len(migrations) != EXPECTED_MIGRATIONS
            or len(operations) != EXPECTED_OPERATIONS):
        fail("plan differs from reviewed SHA-256 / 36 migrations / 200 operations")
    print("PASS: plan matches reviewed document, SHA-256", digest)
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
