"""SEC-01 Review-only incremental migration; guard against copied Production users.

Run only on explicitly isolated Neon Preview with zero users/tokens. Never
apply to Production. Use Django's actual migration executor, not manual SQL.
"""
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

import psycopg

REPO = Path(__file__).resolve().parents[2]
PREVIEW_TARGETS = {
    "review/cloud-sec-01-auth-hardening":
        "ep-rapid-tree-b8sqdze9.c-14.us-east-1.aws.neon.tech",
    "review/cloud-sec-01-bff-session":
        "ep-winter-mode-b86rg1ko.c-14.us-east-1.aws.neon.tech",
}
AUTHORIZATION = "APPLY SEC01 0003 TO ISOLATED NEON REVIEW ONLY"


def deny(reason):
    raise SystemExit("SEC01 REVIEW MIGRATION REFUSED: " + reason)


def validate_target():
    branch = os.environ.get("OCTALVE_SEC01_REVIEW_BRANCH", "")
    if branch not in PREVIEW_TARGETS:
        deny("unknown isolated Review branch")
    uri = os.environ.get("DATABASE_URL_UNPOOLED", "")
    if not uri or any(ch.isspace() for ch in uri):
        deny("missing or malformed direct Review connection string")
    try:
        p = urlsplit(uri)
        ssl = parse_qs(p.query).get("sslmode")
        valid = (
            p.scheme in ("postgresql", "postgres")
            and p.hostname == PREVIEW_TARGETS[branch]
            and p.path == "/neondb"
            and p.username == "neondb_owner"
            and bool(p.password)
            and ssl in (["require"], ["verify-full"])
        )
    except (TypeError, ValueError):
        valid = False
    if not valid:
        deny("wrong direct host, database, role, or TLS; Production forbidden")
    return uri


def verify_isolation(uri):
    with psycopg.connect(uri, sslmode="require", connect_timeout=15) as db:
        if db.pgconn.ssl_in_use is not True:
            deny("unencrypted database connection")
        with db.cursor() as cur:
            cur.execute("""
                SELECT current_database(), current_user,
                    (SELECT count(*) FROM public.django_migrations),
                    (SELECT count(*) FROM information_schema.tables
                      WHERE table_schema='public' AND table_type='BASE TABLE'),
                    (SELECT count(*) FROM public.accounts_customuser),
                    (SELECT count(*) FROM public.token_blacklist_outstandingtoken),
                    (SELECT count(*) FROM public.token_blacklist_blacklistedtoken),
                    to_regclass('public.accounts_auththrottlebucket')::text
            """)
            state = cur.fetchone()
    db_name, role, migrations, tables, users, outstanding, revoked, throttle = state
    if (db_name, role, migrations, tables, users, outstanding, revoked, throttle) != (
        "neondb", "neondb_owner", 48, 91, 0, 0, 0, None
    ):
        deny("Preview is not a synthetic-only clean 48/91 baseline; do not test against Production clones")
    print("PASS: exact SEC01 Review target, encrypted direct connection, zero users/tokens, 48/91 schema.")


def check_incremental_plan(uri):
    env = os.environ.copy()
    env["DATABASE_URL"] = uri
    env["DEBUG"] = "false"
    env.setdefault("DJANGO_SECRET_KEY", "SEC01-review-script-only-temporary-secret-never-deploy-123456789")
    env.setdefault("FRONTEND_URL", "http://localhost:3000")
    result = subprocess.run(
        [sys.executable, "manage.py", "migrate", "accounts", "0003", "--plan"],
        cwd=REPO / "backend", env=env, capture_output=True,
        text=True, timeout=120, check=False,
    )
    if result.returncode != 0:
        deny("Django failed to inspect incremental migration graph")
    lines = [x.strip() for x in result.stdout.splitlines()]
    if lines.count("accounts.0003_auththrottlebucket") != 1:
        deny("expected precisely accounts.0003 in pending migration graph")
    if any("contenttypes." in x or "token_blacklist." in x for x in lines):
        deny("unexpected historical app migrations pending")
    print("PASS: exactly one required accounts.0003_auththrottlebucket migration.")
    return env


def run():
    if len(sys.argv) != 2 or sys.argv[1] not in ("plan", "apply"):
        deny("usage: sec01_review_schema_cli.py plan|apply")
    uri = validate_target()
    verify_isolation(uri)
    env = check_incremental_plan(uri)
    if sys.argv[1] == "plan":
        print("PLAN ONLY: no schema changes. SEC01 Review copy is not authorized unless synthetic-only.")
        return
    try:
        typed = input("Type exact approval [" + AUTHORIZATION + "]: ")
    except EOFError:
        deny("interactive approval missing")
    if typed != AUTHORIZATION:
        deny("interactive approval mismatch")
    result = subprocess.run(
        [sys.executable, "manage.py", "migrate", "accounts", "0003", "--noinput"],
        cwd=REPO / "backend", env=env, timeout=600, check=False,
    )
    if result.returncode != 0:
        deny("Django migration failed; inspect before retrying")
    with psycopg.connect(uri, sslmode="require", connect_timeout=15) as db:
        with db.cursor() as cur:
            cur.execute("""
                SELECT (SELECT count(*) FROM public.django_migrations),
                       (SELECT count(*) FROM information_schema.tables
                         WHERE table_schema='public' AND table_type='BASE TABLE'),
                       to_regclass('public.accounts_auththrottlebucket')::text
            """)
            state = cur.fetchone()
    if state != (49, 92, "accounts_auththrottlebucket"):
        deny("incremental Review schema verification mismatch")
    print("PASS: SEC01 Review only, 49 migrations and 92 tables. Production unchanged.")


if __name__ == "__main__":
    run()
