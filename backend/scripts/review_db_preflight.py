"""Review-only database preflight. Never logs credentials or database URL.

Run before migrating a fresh, isolated Neon database. Existing databases
without a Django migration ledger are rejected rather than overwritten.
"""
import os
from urllib.parse import urlsplit

import psycopg


def main():
    url = os.environ.get("DATABASE_URL", "")
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise SystemExit("Refusing migration: PostgreSQL DATABASE_URL required")
    if not (host.endswith(".neon.tech") or host == "neon.tech"):
        raise SystemExit("Refusing migration: expected isolated Neon host")
    if "pooler" in host:
        raise SystemExit("Refusing migration: supply Neon direct/unpooled URL")
    if os.getenv("OCTALVE_CLOUD_ENV") != "review":
        raise SystemExit("Refusing migration: OCTALVE_CLOUD_ENV must equal review")
    if not os.getenv("CLOUD_REVIEW_MIGRATION_CONFIRM"):
        raise SystemExit("Refusing migration: missing review-only migration confirmation")

    with psycopg.connect(url, connect_timeout=10, sslmode="require") as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()")
            ssl = cursor.fetchone()
            if not ssl or ssl[0] is not True:
                raise SystemExit("Refusing migration: PostgreSQL TLS not established")
            cursor.execute(
                """SELECT tablename FROM pg_tables WHERE schemaname = 'public'"""
            )
            tables = {r[0] for r in cursor.fetchall()}
            if tables and "django_migrations" not in tables:
                raise SystemExit(
                    "Refusing migration: existing database tables without Django migration ledger"
                )
    print("PASS: isolated Neon PostgreSQL, TLS active, migration ledger state safe")
    print("Existing Django migration ledger:", "present" if tables else "absent")
    # Deliberately never prints username, hostname, password, database name or URL.


if __name__ == "__main__":
    main()
