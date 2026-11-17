"""DNS-01C local Production migration is single-target, idempotent and fail-closed."""
import os
import sys
import unittest
from unittest.mock import patch

from scripts.production_dns01c_preflight import (
    checked_url, runtime_guard, main, database_state, EXPECTED_BEFORE, EXPECTED_AFTER,
    TARGET,
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
