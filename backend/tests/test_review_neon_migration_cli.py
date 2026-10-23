"""Secret-free regression tests for Neon's migration connection preflight.

These tests use in-memory fake connections. No Neon credentials or DB writes.
"""
import contextlib
import importlib.util
import io
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest import mock

path = Path(__file__).resolve().parents[1] / "scripts" / "review_neon_migration_cli.py"
with mock.patch.dict(sys.modules, {"psycopg": ModuleType("psycopg")}):
    spec = importlib.util.spec_from_file_location("_review_neon_migration_cli_check", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to import guarded Neon runner")
    cli = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cli)


class FakeCursor:
    def __init__(self, row):
        self.row = row
        self.query = None

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, statement):
        self.query = statement

    def fetchone(self):
        return self.row


class FakeConnection:
    def __init__(self, tls=True, row=("neondb", "neondb_owner", 0, None)):
        self.pgconn = SimpleNamespace(ssl_in_use=tls)
        self.cur = FakeCursor(row)

    def cursor(self):
        return self.cur


class NeonMigrationPreflightTests(unittest.TestCase):
    def test_client_tls_true_allows_correct_empty_review_database(self):
        conn = FakeConnection()
        with contextlib.redirect_stdout(io.StringIO()) as output:
            cli.check_connection_identity(conn)
        self.assertIn("client TLS enabled", output.getvalue())
        self.assertNotIn("pg_stat_ssl", conn.cur.query)

    def test_client_side_tls_is_mandatory(self):
        with self.assertRaisesRegex(SystemExit, "client-to-Neon"):
            cli.check_connection_identity(FakeConnection(tls=False))

    def test_unexpected_database_is_rejected(self):
        with self.assertRaisesRegex(SystemExit, "database or role"):
            cli.check_connection_identity(FakeConnection(row=("other", "neondb_owner", 0, None)))

    def test_unexpected_role_is_rejected(self):
        with self.assertRaisesRegex(SystemExit, "database or role"):
            cli.check_connection_identity(FakeConnection(row=("neondb", "other", 0, None)))

    def test_existing_tables_are_rejected(self):
        with self.assertRaisesRegex(SystemExit, "nonempty schema"):
            cli.check_connection_identity(FakeConnection(row=("neondb", "neondb_owner", 1, None)))

    def test_existing_migration_ledger_is_rejected(self):
        with self.assertRaisesRegex(SystemExit, "nonempty schema"):
            cli.check_connection_identity(FakeConnection(row=("neondb", "neondb_owner", 0, "django_migrations")))


if __name__ == "__main__":
    unittest.main()
