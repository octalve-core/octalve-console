"""The DNS-01 operator preflight can never execute a Production migration."""
import os
import sys
import unittest
from unittest.mock import patch

from scripts.production_dns01_preflight import checked_url, main


class DNS01OperatorPreflightTests(unittest.TestCase):
    def test_no_apply_command_or_ci_execution(self):
        with patch.object(sys, "argv", ["production_dns01_preflight.py", "apply"]):
            with self.assertRaisesRegex(SystemExit, "Only plan is supported"):
                main()
        with patch.object(sys, "argv", ["production_dns01_preflight.py", "plan"]):
            for key in ("CI", "VERCEL", "GITHUB_ACTIONS"):
                with self.subTest(environment=key), patch.dict(os.environ, {
                    "OCTALVE_CLOUD_ENV": "production", "DEBUG": "false", key: "1"
                }, clear=True):
                    with self.assertRaisesRegex(SystemExit, "local Production preflight"):
                        main()

    def test_untrusted_endpoints_and_missing_tls_fail_before_database_access(self):
        cases = [
            "postgresql://neondb_owner:synthetic@localhost:5432/neondb?sslmode=require",
            "postgresql://neondb_owner:synthetic@ep-cool-butterfly-b8jvzofp-pooler.c-14.us-east-1.aws.neon.tech/neondb?sslmode=require",
            "postgresql://another:synthetic@ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech/neondb?sslmode=require",
            "postgresql://neondb_owner:synthetic@ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech/neondb?sslmode=disable",
        ]
        for url in cases:
            with self.subTest(url=url.split("@")[-1]),patch.dict(os.environ, {"DATABASE_URL": url}, clear=True):
                with self.assertRaisesRegex(SystemExit, "Exact direct Production host"):
                    checked_url()
