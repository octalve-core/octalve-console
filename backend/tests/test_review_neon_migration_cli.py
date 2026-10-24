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



    def test_plan_capture_forces_utf8_regardless_of_host_locale(self):
        expected = SimpleNamespace(returncode=0, stdout="    Raw Python operation -> prox…\n", stderr="")
        with mock.patch.object(cli.subprocess, "run", return_value=expected) as runner:
            result = cli.capture_django_plan(Path("backend"), {"VERCEL_ENV": "preview"})
        self.assertEqual(result, expected)
        arguments = runner.call_args.kwargs
        self.assertEqual(arguments["env"]["PYTHONIOENCODING"], "utf-8")
        self.assertEqual(arguments["encoding"], "utf-8")
        self.assertEqual(arguments["errors"], "strict")
        self.assertNotIn("PYTHONIOENCODING", {"VERCEL_ENV": "preview"})

    def test_recorded_transcript_matches_approved_hash(self):
        root = path.parents[2]
        import hashlib
        doc = (root / "docs" / "CLOUD_FOUNDATION_NEON_INITIAL_MIGRATION_PLAN_2026-10-23.md").read_text(encoding="utf-8")
        doc = doc.replace("\r\n", "\n")
        marker = "```text\n"
        start = doc.find(marker)
        end = doc.find("\n```", start + len(marker))
        self.assertGreaterEqual(start, 0)
        self.assertGreaterEqual(end, 0)
        transcript = doc[start + len(marker):end] + "\n"
        self.assertEqual(hashlib.sha256(transcript.encode("utf-8")).hexdigest(), cli.EXPECTED_PLAN_SHA256)
        with contextlib.redirect_stdout(io.StringIO()):
            cli.verify_reviewed_plan(transcript, root)

    def test_mismatch_reports_only_plan_operation_without_approving(self):
        root = path.parents[2]
        with contextlib.redirect_stdout(io.StringIO()) as output:
            with self.assertRaisesRegex(SystemExit, "plan differs"):
                cli.verify_reviewed_plan("Planned operations:\nother.0001_initial\n", root)
        self.assertIn("First differing Django plan line:", output.getvalue())


    def test_exact_known_auth_description_variant_is_accepted(self):
        root = path.parents[2]
        source = (root / "docs" / "CLOUD_FOUNDATION_NEON_INITIAL_MIGRATION_PLAN_2026-10-23.md").read_text(encoding="utf-8")
        marker = "```text\n"
        first = source.index(marker) + len(marker)
        last = source.index("\n```", first)
        original = source[first:last] + "\n"
        self.assertEqual(original.count(cli.APPROVED_DESCRIPTION_LINE + "\n"), 1)
        alternate = original.replace(
            cli.APPROVED_DESCRIPTION_LINE + "\n", cli.ALTERNATE_DESCRIPTION_LINE + "\n", 1
        )
        import hashlib
        self.assertEqual(
            hashlib.sha256(alternate.encode("utf-8")).hexdigest(),
            cli.EXPECTED_ALTERNATE_PLAN_SHA256,
        )
        with contextlib.redirect_stdout(io.StringIO()) as result:
            cli.verify_reviewed_plan(alternate, root)
        self.assertIn("every other plan byte matches", result.getvalue())

    def test_any_other_operation_difference_is_rejected(self):
        root = path.parents[2]
        source = (root / "docs" / "CLOUD_FOUNDATION_NEON_INITIAL_MIGRATION_PLAN_2026-10-23.md").read_text(encoding="utf-8")
        marker = "```text\n"
        first = source.index(marker) + len(marker)
        last = source.index("\n```", first)
        original = source[first:last] + "\n"
        alternate = original.replace(
            cli.APPROVED_DESCRIPTION_LINE + "\n", cli.ALTERNATE_DESCRIPTION_LINE + "\n", 1
        )
        tampered = alternate.replace("Create model ContentType", "Create model AlteredType", 1)
        with contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(SystemExit, "locked reviewed migrations"):
                cli.verify_reviewed_plan(tampered, root)

if __name__ == "__main__":
    unittest.main()
