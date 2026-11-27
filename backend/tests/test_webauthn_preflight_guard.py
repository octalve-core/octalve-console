"""Synthetic tests for AUTH-02 guards; never connect to Production."""
import os
import sys
import unittest
from unittest.mock import MagicMock, patch
from scripts import production_webauthn_preflight as runner

URL = "postgresql://neondb_owner:synthetic@ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech/neondb?sslmode=require"

class WebAuthnMigrationGuardTests(unittest.TestCase):
    def test_exact_scope(self):
        self.assertEqual(runner.EXPECTED_BEFORE, (64, 117))
        self.assertEqual(runner.EXPECTED_AFTER, (66, 120))
        self.assertEqual(runner.PLAN, [
            ("accounts", "0004_privileged_webauthn", False),
            ("accounts", "0005_privileged_passkey_enrollment", False)])
        self.assertEqual(len(runner.TABLES), 3)

    def test_url_validation(self):
        with patch.dict(os.environ, {"DATABASE_URL": URL}, clear=True):
            self.assertEqual(runner.checked_url(), URL)
        for url in (URL.replace("sslmode=require","sslmode=disable"),
                    URL.replace("ep-cool-butterfly","ep-other"),
                    URL+"&host=other.example.invalid", URL.replace("/neondb?", "/other?")):
            with patch.dict(os.environ, {"DATABASE_URL": url}, clear=True):
                with self.assertRaises(SystemExit):
                    runner.checked_url()

    def test_ci_and_unverified_backup_refused(self):
        with patch.dict(os.environ, {"OCTALVE_CLOUD_ENV":"production","DEBUG":"false","CI":"true"}, clear=True):
            with self.assertRaises(SystemExit):
                runner.runtime_guard()
        with patch.dict(os.environ, {"OCTALVE_CLOUD_ENV":"production","DEBUG":"false","DATABASE_URL":URL}, clear=True), patch.object(sys,"argv",["runner","apply"]):
            with self.assertRaisesRegex(SystemExit,"backup and completed independent local restore"):
                runner.main()

    def test_exact_ledger_and_partial_schema(self):
        base = {("accounts","0003_auththrottlebucket")} | {("fixture",str(i)) for i in range(63)}
        for count, tables, present, expected in (
            (64,117,(None,None,None),"before"),
            (66,120,runner.TABLES,"after"),
            (65,119,("challenge","passkey",None),None),
            (64,117,("challenge",None,None),None)):
            db = MagicMock()
            cur = db.cursor.return_value.__enter__.return_value
            cur.fetchone.side_effect = [("neondb","neondb_owner",count,tables),present]
            cur.fetchall.return_value = list(base | set(runner.TARGETS[:count-64]))
            if expected:
                self.assertEqual(runner.database_state(db)[0],expected)
            else:
                with self.assertRaises(SystemExit):
                    runner.database_state(db)

    def test_ledger_digest_stable(self):
        self.assertEqual(runner.ledger_digest({("b","2"),("a","1")}),runner.ledger_digest([("a","1"),("b","2")]))
        self.assertNotEqual(runner.ledger_digest({("a","1")}),runner.ledger_digest({("a","2")}))

    def test_refuses_changed_backup_ledger_before_prompt(self):
        conn = MagicMock()
        with patch.dict(os.environ, {"OCTALVE_CLOUD_ENV":"production","DEBUG":"false","DATABASE_URL":URL,"OCTALVE_WEBAUTHN_SOURCE_APPROVED":"true","OCTALVE_WEBAUTHN_LEDGER_SHA256":"wrong"}, clear=True), patch.object(sys,"argv",["runner","apply"]), patch.object(runner,"verify_backup_and_restore"), patch.object(runner,"_direct_connection",return_value=conn), patch.object(runner,"database_state",return_value=("before",set())), patch.object(runner,"validated_plan",return_value=runner.PLAN), patch("builtins.input") as prompt, patch.object(runner,"_migrate_target_once") as mutate:
            with self.assertRaisesRegex(SystemExit,"Restored backup ledger differs"):
                runner.main()
            prompt.assert_not_called()
            mutate.assert_not_called()

    def test_no_write_without_exact_approval(self):
        ledger = {("accounts","0003_auththrottlebucket")}
        env = {"OCTALVE_CLOUD_ENV":"production","DEBUG":"false","DATABASE_URL":URL,
               "OCTALVE_WEBAUTHN_SOURCE_APPROVED":"true","OCTALVE_WEBAUTHN_LEDGER_SHA256":runner.ledger_digest(ledger)}
        with patch.dict(os.environ,env,clear=True), patch.object(sys,"argv",["runner","apply"]), patch.object(runner,"verify_backup_and_restore"), patch.object(runner,"_direct_connection",return_value=MagicMock()), patch.object(runner,"database_state",return_value=("before",ledger)), patch.object(runner,"validated_plan",return_value=runner.PLAN), patch.object(runner,"_close_django_connections"), patch("builtins.input",return_value="no"), patch.object(runner,"_migrate_target_once") as mutate:
            with self.assertRaisesRegex(SystemExit,"approval phrase missing"):
                runner.main()
            mutate.assert_not_called()

    def test_no_retry_after_ambiguous_write(self):
        ledger = {("accounts","0003_auththrottlebucket")}
        env = {"OCTALVE_CLOUD_ENV":"production","DEBUG":"false","DATABASE_URL":URL,
               "OCTALVE_WEBAUTHN_SOURCE_APPROVED":"true","OCTALVE_WEBAUTHN_LEDGER_SHA256":runner.ledger_digest(ledger)}
        with patch.dict(os.environ,env,clear=True), patch.object(sys,"argv",["runner","apply"]), patch.object(runner,"verify_backup_and_restore"), patch.object(runner,"_direct_connection",return_value=MagicMock()), patch.object(runner,"database_state",return_value=("before",ledger)), patch.object(runner,"validated_plan",return_value=runner.PLAN), patch.object(runner,"_close_django_connections"), patch("builtins.input",return_value="APPLY WEBAUTHN 0004 0005 TO OCTALVE PRODUCTION"), patch.object(runner,"_migrate_target_once",side_effect=RuntimeError("synthetic disconnect")) as mutate, patch.object(runner,"_readback_after_migration") as post:
            with self.assertRaisesRegex(RuntimeError,"synthetic disconnect"):
                runner.main()
            mutate.assert_called_once_with(ledger)
            post.assert_not_called()
