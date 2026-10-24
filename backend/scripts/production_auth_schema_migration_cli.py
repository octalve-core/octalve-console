"""One-off, fail-closed Production Django schema migration for Octalve Cloud.

Never run as part of Vercel build, deploy, request, cron, CI, or application
startup. Requires the production owner's interactive, exact typed consent.
This source must never print credentials, JWTs, or connection URLs.
"""
import os
import secrets
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

import psycopg

from review_auth_blacklist_migration_cli import verify_plan, PLAN_SHA, MIGRATIONS, OPERATIONS
from review_neon_migration_cli import capture_django_plan

HOST = "ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech"
ROLE = "neondb_owner"
DATABASE = "neondb"
BACKUP_BRANCH_ID = "br-wild-sea-b8dy0nsz"
AUTH_PHRASE = "APPLY 48 AUTH MIGRATIONS TO OCTALVE CLOUD NEON MAIN"
REPO = Path(__file__).resolve().parents[2]


def refuse(reason):
    raise SystemExit("PRODUCTION AUTH MIGRATION REFUSED: " + reason)


def validate_direct_url(value):
    if not value or value.strip() != value or any(c.isspace() for c in value):
        refuse("missing or malformed direct PostgreSQL connection")
    try:
        parts = urlsplit(value)
        query = parse_qs(parts.query)
        valid = (
            parts.scheme in ("postgres", "postgresql")
            and parts.hostname == HOST
            and parts.path == "/" + DATABASE
            and parts.username == ROLE
            and bool(parts.password)
            and "-pooler" not in (parts.hostname or "")
            and query.get("sslmode") in (["require"], ["verify-full"])
        )
    except Exception:
        valid = False
    if not valid:
        refuse("target must match exact Neon MAIN direct host, role, database and SSL")
    return value


def verify_empty_production(url):
    with psycopg.connect(url, sslmode="require", connect_timeout=15) as conn:
        if conn.pgconn.ssl_in_use is not True:
            refuse("Neon connection does not use TLS")
        with conn.cursor() as cur:
            cur.execute("""
                SELECT current_database(), current_user,
                    (SELECT COUNT(*) FROM information_schema.tables
                     WHERE table_schema='public' AND table_type='BASE TABLE'),
                    to_regclass('public.django_migrations')::text
            """)
            name, role, tables, ledger = cur.fetchone()
        if (name, role, tables, ledger) != (DATABASE, ROLE, 0, None):
            refuse("unexpected identity, existing tables or migration ledger")
    print("PASS: Neon MAIN direct target, identity, TLS and empty public schema.")


def get_plan(url):
    env = os.environ.copy()
    env.update({
        "DATABASE_URL": url,
        "DEBUG": "false",
        "FRONTEND_URL": "https://console.cloud.octalve.com",
        "DJANGO_SECRET_KEY": secrets.token_hex(40),
    })
    plan = capture_django_plan(REPO / "backend", env)
    if plan.returncode != 0:
        refuse("Django could not inspect the migration plan")
    verify_plan(plan.stdout, REPO)
    return env


def verify_applied(url):
    with psycopg.connect(url, sslmode="require", connect_timeout=15) as conn:
        if conn.pgconn.ssl_in_use is not True:
            refuse("TLS was lost")
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM public.django_migrations")
            migrations = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM public.django_migrations WHERE app='token_blacklist'")
            blacklisted = cur.fetchone()[0]
            cur.execute("""SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema='public' AND table_type='BASE TABLE'""")
            tables = cur.fetchone()[0]
    if (migrations, blacklisted, tables) != (48, 12, 91):
        refuse("migration applied but schema ledger/count differs; inspect before proceeding")
    print("PASS: Production Neon has exactly 48 migrations, 12 JWT-blacklist migrations and 91 tables.")


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("plan", "apply"):
        refuse("usage: production_auth_schema_migration_cli.py plan|apply")
    if os.environ.get("OCTALVE_CLOUD_ENV") != "production":
        refuse("explicit Production environment marker required")
    url = validate_direct_url(os.environ.get("DATABASE_URL_UNPOOLED", ""))
    verify_empty_production(url)
    env = get_plan(url)
    if sys.argv[1] == "plan":
        print("PLAN ONLY. Source matches exact SHA-256 " + PLAN_SHA)
        print("No Production database changes have been made.")
        return
    if os.environ.get("OCTALVE_PRODUCTION_BACKUP_BRANCH_ID") != BACKUP_BRANCH_ID:
        refuse("verified pre-production recovery branch acknowledgement missing")
    print("Production Neon MAIN migration is irreversible without a verified restore plan.")
    print("Independent recovery branch required: " + BACKUP_BRANCH_ID)
    # Authorization cannot be injected by an unattended workflow.
    try:
        response = input("Type exact Production approval phrase: ")
    except EOFError:
        refuse("interactive approval unavailable")
    if response != AUTH_PHRASE:
        refuse("interactive authorization rejected")
    result = subprocess.run(
        [sys.executable, "manage.py", "migrate", "--noinput"],
        cwd=REPO / "backend", env=env, timeout=900, check=False,
    )
    if result.returncode:
        refuse("Django migration failed; DO NOT retry or reset database before inspection")
    verify_applied(url)


if __name__ == "__main__":
    main()
