"""DNS-01C local Production migration is single-target, idempotent and fail-closed."""
import os
import sys
import unittest
from types import ModuleType
from unittest.mock import patch, MagicMock

from scripts.production_dns01c_preflight import (
    checked_url, runtime_guard, main, database_state, EXPECTED_BEFORE, EXPECTED_AFTER,
    TARGET, _locked_fresh_session, _lock_release, _readback_after_migration,
)

VALID_URL = (
    "postgresql://neondb_owner:synthetic@"
    "ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech"
    "/neondb?sslmode=require"
)


class DNS01COperatorGuardTests(unittest.TestCase):
    def test_exact_authority_and_one_migration(self):
        self.assertEqual(EXPECTED_BEFORE,(63,116))
        self.assertEqual(EXPECTED_AFTER,(64,117))
        self.assertEqual(TARGET,("domains","0003_external_dns_claims"))

    def test_unreviewed_commands_and_missing_restored_backup_refused(self):
        with patch.object(sys,"argv",["runner","delete"]):
            with self.assertRaisesRegex(SystemExit,"Specify only plan or apply"):
                main()
        with patch.object(sys,"argv",["runner","apply"]),patch.dict(os.environ,{
            "DATABASE_URL":VALID_URL,"OCTALVE_CLOUD_ENV":"production","DEBUG":"false"
        },clear=True):
            with self.assertRaisesRegex(SystemExit,"backup and completed independent local restore"):
                main()

    def test_exact_new_claim_table_and_existing_binding_required(self):
        from unittest.mock import MagicMock
        def checked_database(old, binding=True):
            cursor = MagicMock()
            cursor.fetchone.side_effect = [
                ("neondb", "neondb_owner", 63 if old else 64,
                 116 if old else 117),
                (None if old else "domains_domaindnsclaim",
                 "domains_domaindnsbinding" if binding else None,
                 "providers_integrationconnectionevent"),
            ]
            applied = {
                ("domains", "0001_initial"),
                ("domains", "0002_dns_readonly_binding"),
                ("providers", "0002_integration_draft_vault"),
                ("providers", "0003_provider_vault_authenticator"),
                ("providers", "0004_provider_event_integrity"),
            }
            if not old:
                applied.add(("domains", "0003_external_dns_claims"))
            cursor.fetchall.return_value = list(applied)
            connection = MagicMock()
            connection.cursor.return_value.__enter__.return_value = cursor
            return connection, cursor
        db, cursor = checked_database(True)
        state, _ = database_state(db)
        self.assertEqual(state, "before")
        query = cursor.execute.call_args_list[2].args[0]
        self.assertIn("domains_domaindnsclaim", query)
        self.assertIn("domains_domaindnsbinding", query)
        db, _ = checked_database(False)
        self.assertEqual(database_state(db)[0], "after")
        db, _ = checked_database(True, binding=False)
        with self.assertRaisesRegex(SystemExit, "prerequisites are missing"):
            database_state(db)

    def test_ci_vercel_debug_and_wrong_sql_origin_are_rejected(self):
        for name in ("CI","GITHUB_ACTIONS","VERCEL","VERCEL_ENV","VERCEL_URL"):
            with self.subTest(name=name),patch.dict(os.environ,{
                "OCTALVE_CLOUD_ENV":"production","DEBUG":"false",name:"1"
            },clear=True):
                with self.assertRaisesRegex(SystemExit,"trusted Production workstation"):
                    runtime_guard()
        for url in (VALID_URL.replace("neondb_owner","other"),
                    VALID_URL.replace("sslmode=require","sslmode=disable"),
                    VALID_URL.replace("ep-cool-butterfly","ep-other"),
                    VALID_URL.replace("/neondb?","/test?")):
            with self.subTest(url=url.split("@")[-1]),patch.dict(os.environ,{
                "DATABASE_URL":url
            },clear=True):
                with self.assertRaisesRegex(SystemExit,"Exact direct Neon Production"):
                    checked_url()
        with patch.dict(os.environ,{"DATABASE_URL":VALID_URL},clear=True):
            self.assertEqual(checked_url(),VALID_URL)


class _SimulatedNeonDisconnect(Exception):
    """Simulates server-side SQLSTATE 57P01 without a PostgreSQL server."""


class _SimulatedConnectionClosed(Exception):
    """Simulates psycopg's InterfaceError after a terminated session."""


_FAKE_PSYCOPG = ModuleType("psycopg")
_FAKE_PSYCOPG.OperationalError = _SimulatedNeonDisconnect
_FAKE_PSYCOPG.InterfaceError = _SimulatedConnectionClosed


@patch.dict(sys.modules, {"psycopg": _FAKE_PSYCOPG})
class DNS01CTransientSessionTests(unittest.TestCase):
    """Force the operator's observed Neon AdminShutdown without real writes."""

    @staticmethod
    def connection():
        db = MagicMock()
        db.pgconn.ssl_in_use = True
        db.closed = False
        db.cursor.return_value.__enter__.return_value.fetchone.return_value = (True,)
        def close():
            db.closed = True
        db.close.side_effect = close
        return db

    def test_57p01_during_read_only_release_check_reconnects_once(self):
        import psycopg
        ledger = frozenset({("domains", "0002_dns_readonly_binding")})
        dead, fresh = self.connection(), self.connection()
        with patch("scripts.production_dns01c_preflight._direct_connection",
                   side_effect=[dead, fresh]) as connect, \
             patch("scripts.production_dns01c_preflight.database_state",
                   side_effect=[psycopg.OperationalError(
                       '57P01: terminating connection due to administrator command'),
                                ("before", ledger)]) as state, \
             patch("scripts.production_dns01c_preflight.validated_plan",
                   return_value=[("domains", "0003_external_dns_claims", False)]):
            returned = _locked_fresh_session("SYNTHETIC_NOT_A_URL", ledger)
        self.assertIs(returned, fresh)
        self.assertEqual(connect.call_count, 2)
        self.assertEqual(state.call_count, 2)
        self.assertTrue(dead.closed)
        self.assertFalse(fresh.closed)
        _lock_release(fresh)
        fresh.close()

    def test_state_change_after_reconnect_refuses_without_any_migration(self):
        import psycopg
        ledger = frozenset({("domains", "0002_dns_readonly_binding")})
        dead, fresh = self.connection(), self.connection()
        with patch("scripts.production_dns01c_preflight._direct_connection",
                   side_effect=[dead, fresh]), \
             patch("scripts.production_dns01c_preflight.database_state",
                   side_effect=[psycopg.OperationalError("connection dropped"),
                                ("after", ledger)]), \
             patch("scripts.production_dns01c_preflight.validated_plan") as plan:
            with self.assertRaisesRegex(SystemExit, "Migration state changed"):
                _locked_fresh_session("SYNTHETIC", ledger)
        plan.assert_not_called()
        self.assertTrue(dead.closed)
        self.assertTrue(fresh.closed)

    def test_closed_session_cleanup_never_obscures_primary_termination(self):
        closed = self.connection()
        closed.closed = True
        _lock_release(closed)
        closed.cursor.assert_not_called()

    def test_approved_operator_gets_fresh_session_after_prompt(self):
        import psycopg
        before = self.connection()
        before.__enter__.return_value = before
        def exit_before(*_args):
            before.close()
        before.__exit__.side_effect = exit_before
        release = self.connection()
        ledger = frozenset({("domains", "0002_dns_readonly_binding")})
        seen = []
        def operator_prompt(_prompt):
            self.assertTrue(before.closed, "Preflight session must close before approval")
            seen.append("operator")
            return "APPLY DNS01C 0003 TO OCTALVE PRODUCTION"
        def new_session(_url, original_ledger):
            self.assertEqual(seen, ["operator"])
            self.assertEqual(original_ledger, ledger)
            seen.append("fresh-session")
            return release
        def migration(*args, **kwargs):
            self.assertEqual(seen, ["operator", "fresh-session"])
            self.assertEqual(args, ("migrate", "domains", "0003_external_dns_claims"))
            seen.append("migration")
        def postflight(_url):
            self.assertEqual(seen, ["operator", "fresh-session", "migration"])
            seen.append("postflight")
        env = {
            "OCTALVE_CLOUD_ENV": "production",
            "DEBUG": "false",
            "OCTALVE_DNS01C_SOURCE_APPROVED": "true",
        }
        with patch.dict(os.environ, env, clear=True), \
             patch.object(sys, "argv", ["dns01c_runner", "apply"]), \
             patch("scripts.production_dns01c_preflight.verify_backup_and_restore"), \
             patch("scripts.production_dns01c_preflight.checked_url", return_value="SYNTHETIC"), \
             patch("scripts.production_dns01c_preflight._direct_connection",
                   return_value=before), \
             patch("scripts.production_dns01c_preflight.database_state",
                   return_value=("before", ledger)), \
             patch("scripts.production_dns01c_preflight.validated_plan",
                   return_value=[("domains", "0003_external_dns_claims", False)]), \
             patch("scripts.production_dns01c_preflight._locked_fresh_session",
                   side_effect=new_session), \
             patch("scripts.production_dns01c_preflight._readback_after_migration",
                   side_effect=postflight), \
             patch("builtins.input", side_effect=operator_prompt), \
             patch("django.db.connections.close_all"), \
             patch("django.core.management.call_command", side_effect=migration) as run:
            main()
        self.assertEqual(seen, ["operator", "fresh-session", "migration", "postflight"])
        self.assertEqual(run.call_count, 1)
        self.assertTrue(release.closed)

    def test_mutation_failure_is_never_retried_or_hidden_by_cleanup(self):
        import psycopg
        before = self.connection()
        before.__enter__.return_value = before
        before.__exit__.side_effect = lambda *_: before.close()
        release = self.connection()
        ledger = frozenset({("domains", "0002_dns_readonly_binding")})
        with patch.dict(os.environ, {
            "OCTALVE_CLOUD_ENV": "production",
            "DEBUG": "false",
            "OCTALVE_DNS01C_SOURCE_APPROVED": "true",
        }, clear=True), \
             patch.object(sys, "argv", ["dns01c_runner", "apply"]), \
             patch("scripts.production_dns01c_preflight.verify_backup_and_restore"), \
             patch("scripts.production_dns01c_preflight.checked_url", return_value="SYNTHETIC"), \
             patch("scripts.production_dns01c_preflight._direct_connection",
                   return_value=before), \
             patch("scripts.production_dns01c_preflight.database_state",
                   return_value=("before", ledger)), \
             patch("scripts.production_dns01c_preflight.validated_plan",
                   return_value=[("domains", "0003_external_dns_claims", False)]), \
             patch("scripts.production_dns01c_preflight._locked_fresh_session",
                   return_value=release), \
             patch("scripts.production_dns01c_preflight._readback_after_migration") as post, \
             patch("builtins.input", return_value="APPLY DNS01C 0003 TO OCTALVE PRODUCTION"), \
             patch("django.db.connections.close_all"), \
             patch("django.core.management.call_command",
                   side_effect=psycopg.OperationalError("server terminated")) as migration:
            with self.assertRaisesRegex(psycopg.OperationalError, "server terminated"):
                main()
        self.assertEqual(migration.call_count, 1, "Never repeat ambiguous DDL")
        post.assert_not_called()
        self.assertTrue(release.closed)

    def test_postflight_only_reconnects_for_reads(self):
        import psycopg
        first, second = self.connection(), self.connection()
        with patch("scripts.production_dns01c_preflight._direct_connection",
                   side_effect=[first, second]) as connect, \
             patch("scripts.production_dns01c_preflight.verify_dns_postflight",
                   side_effect=[psycopg.OperationalError("lost postflight read"),
                                None]) as verify:
            _readback_after_migration("SYNTHETIC")
        self.assertEqual(connect.call_count, 2)
        self.assertEqual(verify.call_count, 2)
        self.assertTrue(first.closed)
        self.assertTrue(second.closed)
