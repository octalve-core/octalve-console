"""Isolated 48-migration auth Review preflight and explicitly gated apply.

Never invoke this script in CI, deployment startup, or Production.
The baseline 36-migration runner remains separate and unchanged.
"""
import hashlib
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

import psycopg

from review_neon_migration_cli import capture_django_plan

HOST = "ep-patient-butterfly-b8midydm.c-14.us-east-1.aws.neon.tech"
DATABASE = "neondb"
ROLE = "neondb_owner"
PLAN_SHA = "516cd378502964020838c5d23b89caf172bd1cf135677172ee85e4795892a8cd"
MIGRATIONS = 48
OPERATIONS = 217
APPROVAL = "APPLY 48 AUTH MIGRATIONS TO ISOLATED NEON AUTH REVIEW"
BACKUP_BRANCH_ID = "br-broad-meadow-b8fg0eto"
DOC = "CLOUD_FOUNDATION_AUTH_BLACKLIST_INITIAL_MIGRATION_CANDIDATE_2026-10-23.md"


def refuse(message):
    raise SystemExit("AUTH MIGRATION REFUSED: " + message)


def verify_plan(stdout, root):
    source = (root / "docs" / DOC).read_text(encoding="utf-8").replace("\r\n", "\n")
    marker = "```text\n"
    start = source.find(marker)
    stop = source.find("\n```", start + len(marker))
    if start < 0 or stop <= start:
        refuse("reviewed candidate transcript is unavailable")
    reference = source[start + len(marker):stop] + "\n"
    if hashlib.sha256(reference.encode("utf-8")).hexdigest() != PLAN_SHA:
        refuse("recorded candidate has changed since approval")
    # The approved CI transcript and the verified Windows auth.0011
    # display-only variant differ in exactly one truncated docstring line.
    approved_line = "    Raw Python operation ->     Update the content_type of prox…\\n".replace("\\n", "\n")
    windows_line = "    Raw Python operation -> Update the content_type of proxy mo…\\n".replace("\\n", "\n")
    if reference.count(approved_line) != 1:
        refuse("approved auth.0011 description is missing")
    windows_variant = reference.replace(approved_line, windows_line, 1)
    if stdout not in (reference, windows_variant):
        refuse("actual Django operation transcript differs from the recorded candidate")
    migrations = [
        line for line in stdout.splitlines()
        if line and not line.startswith(" ") and line != "Planned operations:"
    ]
    operations = [line for line in stdout.splitlines() if line.startswith("    ")]
    if (len(migrations), len(operations)) != (MIGRATIONS, OPERATIONS):
        refuse("migration and operation counts do not match 48 / 217")
    print("PASS: exact locked 48-migration / 217-operation auth plan:", PLAN_SHA)


def verify_connection(url):
    info = urlsplit(url)
    if info.scheme not in {"postgres", "postgresql"}:
        refuse("PostgreSQL URL required")
    if info.hostname != HOST or info.path.lstrip("/") != DATABASE or info.username != ROLE:
        refuse("host, database, or role is not the specifically approved auth Review target")
    if "-pooler." in (info.hostname or ""):
        refuse("pooled hostname is not permitted")
    if os.environ.get("OCTALVE_CLOUD_ENV") != "review" or os.environ.get("VERCEL_ENV") != "preview":
        refuse("both review and preview environment markers are required")
    with psycopg.connect(url, sslmode="require", connect_timeout=12) as connection:
        if connection.pgconn.ssl_in_use is not True:
            refuse("client connection TLS is missing")
        with connection.cursor() as cursor:
            cursor.execute(
                """SELECT current_database(), current_user,
                          (SELECT count(*) FROM information_schema.tables
                           WHERE table_schema='public' AND table_type='BASE TABLE'),
                          to_regclass('public.django_migrations')::text"""
            )
            db_name, db_role, count, ledger = cursor.fetchone()
    if db_name != DATABASE or db_role != ROLE or count != 0 or ledger is not None:
        refuse("unexpected PostgreSQL identity or nonempty schema")
    print("PASS: exact auth Review host, TLS and empty public schema.")


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in {"plan", "apply"}:
        refuse("usage: review_auth_blacklist_migration_cli.py plan|apply")
    url = os.environ.get("DATABASE_URL_UNPOOLED", "")
    if not url:
        refuse("direct auth Review connection is not set")
    verify_connection(url)
    root = Path(__file__).resolve().parents[2]
    env = os.environ.copy()
    env["DATABASE_URL"] = url
    env["DEBUG"] = "false"
    env.setdefault("DJANGO_SECRET_KEY", "local-cli-only-never-deploy")
    plan = capture_django_plan(root / "backend", env)
    verify_plan(plan.stdout, root)
    if sys.argv[1] == "plan":
        print("PLAN ONLY: no schema modifications.")
        return
    # This is a separate, explicit authorisation gate. No tool or previous
    # foundation approval automatically authorizes this new 48-step schema.
    if os.environ.get("OCTALVE_AUTH_BACKUP_BRANCH_ID") != BACKUP_BRANCH_ID:
        refuse("the specific pre-auth recovery branch has not been acknowledged")
    if os.environ.get("OCTALVE_AUTH_SCHEMA_APPROVAL") != APPROVAL:
        refuse("exact separate owner approval phrase is required")
    print("AUTH REVIEW ONLY: applying the locked approved schema.")
    result = subprocess.run(
        [sys.executable, "manage.py", "migrate", "--noinput"],
        cwd=root / "backend", env=env, timeout=400,
    )
    if result.returncode:
        refuse("migration failed; do not retry until actual DB state is inspected")
    with psycopg.connect(url, sslmode="require", connect_timeout=12) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT count(*) FROM django_migrations")
            applied = cursor.fetchone()[0]
            cursor.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")
            table_count = cursor.fetchone()[0]
            cursor.execute("SELECT count(*) FROM django_migrations WHERE app='token_blacklist'")
            blacklist = cursor.fetchone()[0]
    if (applied, blacklist) != (48, 12) or table_count != 91:
        refuse("post-migration table or ledger counts differ; investigate before use")
    print("PASS: auth Review schema applied; exactly 48 migrations, 12 blacklist and 91 tables.")


if __name__ == "__main__":
    main()
