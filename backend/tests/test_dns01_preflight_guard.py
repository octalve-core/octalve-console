"""DNS-01 operator release: exact target, backup custody and no unattended apply."""
import hashlib
import os
from pathlib import Path
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from scripts.production_dns01_preflight import (
    checked_url, main, runtime_guard, verify_backup_and_restore
)

VALID_URL = (
    "postgresql://neondb_owner:synthetic@"
    "ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech"
    "/neondb?sslmode=require"
)


class DNS01OperatorPreflightTests(unittest.TestCase):
    def test_only_reviewed_plan_and_apply_commands_exist(self):
        with patch.object(sys, "argv", ["production_dns01_preflight.py", "delete"]):
            with self.assertRaisesRegex(SystemExit, "Specify only plan or apply"):
                main()
        # Even when the target URL is syntactically valid, Apply MUST reject
        # absent recovery evidence without attempting any database connection.
        with patch.object(sys, "argv", ["production_dns01_preflight.py", "apply"]), \
             patch.dict(os.environ, {
                 "OCTALVE_CLOUD_ENV": "production", "DEBUG": "false",
                 "DATABASE_URL": VALID_URL,
             }, clear=True):
            with self.assertRaisesRegex(SystemExit, "backup and completed independent local restore"):
                main()

    def test_ci_vercel_and_debug_cannot_execute_any_mode(self):
        for key in ("CI", "VERCEL", "VERCEL_ENV", "GITHUB_ACTIONS"):
            with self.subTest(block=key),patch.dict(os.environ, {
                "OCTALVE_CLOUD_ENV": "production", "DEBUG": "false", key: "1"
            }, clear=True):
                with self.assertRaisesRegex(SystemExit, "interactive trusted"):
                    runtime_guard()
        for bad in ("true", "1"):
            with self.subTest(debug=bad),patch.dict(os.environ, {
                "OCTALVE_CLOUD_ENV": "production", "DEBUG": bad
            }, clear=True):
                with self.assertRaises(SystemExit):
                    runtime_guard()

    def test_untrusted_endpoints_wrong_role_or_missing_tls_rejected(self):
        cases = [
            "postgresql://neondb_owner:synthetic@localhost:5432/neondb?sslmode=require",
            VALID_URL.replace("ep-cool-butterfly", "ep-another"),
            VALID_URL.replace("neondb_owner", "wrong"),
            VALID_URL.replace("sslmode=require", "sslmode=disable"),
            VALID_URL.replace("neondb?sslmode", "other?sslmode"),
            VALID_URL.replace(".aws.neon.tech", "-pooler.c-14.us-east-1.aws.neon.tech"),
        ]
        for url in cases:
            with self.subTest(endpoint=url.split("@")[-1]),patch.dict(os.environ, {
                "DATABASE_URL": url
            }, clear=True):
                with self.assertRaisesRegex(SystemExit, "Exact direct Neon Production"):
                    checked_url()
        with patch.dict(os.environ, {"DATABASE_URL": VALID_URL}, clear=True):
            self.assertEqual(checked_url(), VALID_URL)

    def test_fresh_full_restore_receipt_requires_actual_same_local_archive(self):
        with tempfile.TemporaryDirectory() as folder:
            backup = Path(folder) / "synthetic.dump"
            backup.write_bytes(b"not-a-production-backup\x00" * 800)
            digest = hashlib.sha256(backup.read_bytes()).hexdigest()
            env = {
                "OCTALVE_DNS01_BACKUP_VERIFIED": "true",
                "OCTALVE_DNS01_RESTORE_VERIFIED": "true",
                "OCTALVE_DNS01_BACKUP_FILE": str(backup),
                "OCTALVE_DNS01_BACKUP_SHA256": digest,
                "OCTALVE_DNS01_RESTORE_SHA256": digest,
                "OCTALVE_DNS01_RESTORE_AT": datetime.now(timezone.utc).isoformat(),
            }
            with patch.dict(os.environ, env, clear=True):
                self.assertEqual(verify_backup_and_restore(), digest)
            with patch.dict(os.environ, {**env,
                    "OCTALVE_DNS01_RESTORE_SHA256": "0"*64}, clear=True):
                with self.assertRaisesRegex(SystemExit, "differs"):
                    verify_backup_and_restore()
            backup.write_bytes(backup.read_bytes() + b"x")
            with patch.dict(os.environ, env, clear=True):
                with self.assertRaisesRegex(SystemExit, "no longer matches"):
                    verify_backup_and_restore()
