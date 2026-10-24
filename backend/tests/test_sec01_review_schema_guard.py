"""SEC-01 Review migration guard tests; no network or database secrets."""
import importlib.util
from pathlib import Path
import sys
from types import ModuleType
from unittest import TestCase, mock

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "sec01_review_schema_cli.py"
with mock.patch.dict(sys.modules, {"psycopg": ModuleType("psycopg")}):
    spec = importlib.util.spec_from_file_location("_sec01_review_schema_cli_guard", SCRIPT)
    guard = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(guard)


class ReviewSchemaGuardTests(TestCase):
    def test_never_targets_neon_main(self):
        self.assertTrue(guard.PREVIEW_TARGETS)
        self.assertNotIn("ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech",
                         guard.PREVIEW_TARGETS.values())
        self.assertEqual(len(guard.PREVIEW_TARGETS), 2)

    def test_rejects_absent_wrong_or_pooled_database(self):
        for branch, host in guard.PREVIEW_TARGETS.items():
            cases = [
                "",
                "postgresql://neondb_owner:secret@ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech/neondb?sslmode=require",
                f"postgresql://neondb_owner:secret@{host.replace('.c-14', '-pooler.c-14')}/neondb?sslmode=require",
                f"postgresql://neondb_owner:secret@{host}/neondb?sslmode=disable",
                f"postgresql://other:secret@{host}/neondb?sslmode=require",
            ]
            for case in cases:
                with self.subTest(branch=branch,case=case[:35]), mock.patch.dict(
                    "os.environ",
                    {"DATABASE_URL_UNPOOLED": case, "OCTALVE_SEC01_REVIEW_BRANCH": branch},
                    clear=True,
                ), self.assertRaisesRegex(SystemExit, "REFUSED"):
                    guard.validate_target()

    def test_correct_direct_preview_url_is_accepted(self):
        branch, host = next(iter(guard.PREVIEW_TARGETS.items()))
        uri = f"postgresql://neondb_owner:secret@{host}/neondb?sslmode=require"
        with mock.patch.dict("os.environ", {
            "DATABASE_URL_UNPOOLED": uri,
            "OCTALVE_SEC01_REVIEW_BRANCH": branch,
        }, clear=True):
            self.assertEqual(guard.validate_target(), uri)

    def test_no_apply_without_explicit_interactive_consent(self):
        contents = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('typed = input("Type exact approval [" + AUTHORIZATION + "]: ")', contents)
        self.assertIn('if typed != AUTHORIZATION:', contents)
        self.assertIn('"migrate", "accounts", "0003", "--noinput"', contents)
        self.assertIn('"neondb_owner", 48, 91, 0, 0, 0, None', contents)
        self.assertNotIn("ep-cool-butterfly-b8jvzofp", contents)
