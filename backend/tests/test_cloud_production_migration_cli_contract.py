"""Secret-free tests for the Production Neon migration safeguard.

These tests must never contact Neon or apply migrations.
"""
import importlib.util
from pathlib import Path
import sys
from types import ModuleType
from unittest import TestCase, mock

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "backend" / "scripts"
PATH = SCRIPTS / "production_auth_schema_migration_cli.py"
sys.path.insert(0, str(SCRIPTS))

with mock.patch.dict(sys.modules, {"psycopg": ModuleType("psycopg")}):
    spec = importlib.util.spec_from_file_location("_octalve_production_auth_migration_guard", PATH)
    cli = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cli)


class ProductionAuthMigrationGuardTests(TestCase):
    def test_locked_target_is_neon_main_only(self):
        self.assertEqual(cli.HOST, "ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech")
        self.assertEqual(cli.ROLE, "neondb_owner")
        self.assertEqual(cli.DATABASE, "neondb")
        self.assertEqual(cli.BACKUP_BRANCH_ID, "br-wild-sea-b8dy0nsz")
        self.assertEqual(cli.PLAN_SHA, "516cd378502964020838c5d23b89caf172bd1cf135677172ee85e4795892a8cd")
        self.assertEqual((cli.MIGRATIONS, cli.OPERATIONS), (48, 217))

    def test_rejects_review_url_wrong_host_or_pooler(self):
        for host in (
            "ep-patient-butterfly-b8midydm.c-14.us-east-1.aws.neon.tech",
            "ep-cool-butterfly-b8jvzofp-pooler.c-14.us-east-1.aws.neon.tech",
            "example.net",
        ):
            with self.subTest(host=host), self.assertRaisesRegex(SystemExit, "REFUSED"):
                cli.validate_direct_url("postgresql://neondb_owner:example@" + host + "/neondb?sslmode=require")

    def test_enforces_database_role_and_tls(self):
        host = cli.HOST
        for value in (
            "postgresql://other:example@" + host + "/neondb?sslmode=require",
            "postgresql://neondb_owner:example@" + host + "/other?sslmode=require",
            "postgresql://neondb_owner:example@" + host + "/neondb?sslmode=disable",
            "postgresql://neondb_owner:example@" + host + "/neondb",
            "postgresql://neondb_owner:example@" + host + "/neondb?sslmode=require\n",
        ):
            with self.subTest(url_case=value.split("@")[0][:20]), self.assertRaisesRegex(SystemExit, "REFUSED"):
                cli.validate_direct_url(value)

    def test_correct_identity_not_sufficient_to_apply(self):
        valid = "postgresql://neondb_owner:example@" + cli.HOST + "/neondb?sslmode=require"
        self.assertEqual(cli.validate_direct_url(valid), valid)
        with mock.patch.dict("os.environ", {"OCTALVE_CLOUD_ENV": "review"}, clear=True), \
                mock.patch.object(sys, "argv", ["production_auth_schema_migration_cli.py", "plan"]), \
                self.assertRaisesRegex(SystemExit, "Production environment"):
            cli.main()

    def test_requires_explicit_interactive_approval(self):
        content = PATH.read_text(encoding="utf-8")
        self.assertIn("input(\"Type exact Production approval phrase:", content)
        self.assertIn('result = subprocess.run(', content)
        self.assertNotIn("shell=True", content)
        self.assertNotIn("os.environ.get(\"OCTALVE_AUTH_SCHEMA_APPROVAL\")", content)
        self.assertNotIn("apply-neon-auth-review", content)
