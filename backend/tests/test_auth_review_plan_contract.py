"""Secret-free tests for locked 48-step auth migration verification."""
from pathlib import Path
import contextlib
import importlib.util
import io
import hashlib
import sys
from types import ModuleType
from unittest import TestCase, mock

path = Path(__file__).resolve().parents[1] / "scripts" / "review_auth_blacklist_migration_cli.py"
sys.path.insert(0, str(path.parent))
with mock.patch.dict(sys.modules, {"psycopg": ModuleType("psycopg")}):
    spec = importlib.util.spec_from_file_location("_auth_review_cli", path)
    cli = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cli)

ROOT = path.parents[2]
document = (ROOT / "docs" / cli.DOC).read_text(encoding="utf-8")
marker = "```text\n"
begin = document.index(marker) + len(marker)
end = document.index("\n```", begin)
original = document[begin:end] + "\n"
approved_line = "    Raw Python operation ->     Update the content_type of prox…\n"
windows_line = "    Raw Python operation -> Update the content_type of proxy mo…\n"


class AuthReviewMigrationTests(TestCase):
    def test_candidate_and_recorded_digest(self):
        self.assertEqual(hashlib.sha256(original.encode("utf-8")).hexdigest(), cli.PLAN_SHA)
        with contextlib.redirect_stdout(io.StringIO()):
            cli.verify_plan(original, ROOT)

    def test_exact_windows_display_only_variant(self):
        self.assertEqual(original.count(approved_line), 1)
        with contextlib.redirect_stdout(io.StringIO()):
            cli.verify_plan(original.replace(approved_line, windows_line, 1), ROOT)

    def test_one_real_operation_change_denied(self):
        changed = original.replace("Create model ContentType", "Create model UNEXPECTED", 1)
        with self.assertRaisesRegex(SystemExit, "transcript differs"):
            cli.verify_plan(changed, ROOT)

    def test_postgres_target_and_approval_are_separate(self):
        self.assertEqual(cli.HOST, "ep-patient-butterfly-b8midydm.c-14.us-east-1.aws.neon.tech")
        self.assertEqual(cli.BACKUP_BRANCH_ID, "br-broad-meadow-b8fg0eto")
        self.assertNotEqual(cli.APPROVAL, "APPLY 36 MIGRATIONS TO FOUNDATION PREVIEW")
