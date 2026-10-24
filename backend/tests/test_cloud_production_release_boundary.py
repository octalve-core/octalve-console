"""Release-boundary regression: keep temporary protected Preview mechanics out of deployable source.

This check intentionally needs neither live credentials nor network access.
It does not certify production readiness or replace browser acceptance.
"""
from pathlib import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend" / "src"
BACKEND_SETTINGS = ROOT / "backend" / "octalve_backend" / "settings.py"


class CloudProductionReleaseBoundaryTests(TestCase):
    def test_temporary_api_bridge_is_not_shipped(self):
        self.assertFalse((FRONTEND / "lib/api/review-upstream.ts").exists())
        self.assertTrue((FRONTEND / "app/api/cloud/[...path]/route.ts").exists())

    def test_public_client_and_session_proxy_have_no_review_bypass(self):
        sources = [
            FRONTEND / "lib/api/client.ts",
            FRONTEND / "proxy.ts",
        ]
        prohibited = (
            "x-vercel-protection-bypass",
            "x-vercel-trusted-oidc-idp-token",
            "OCTALVE_CLOUD_REVIEW_BYPASS_SECRET",
            "OCTALVE_CLOUD_REVIEW_UPSTREAM_ORIGIN",
            "octalve-cloud-api-git-review-",
        )
        for path in sources:
            data = path.read_text(encoding="utf-8-sig")
            with self.subTest(path=path.name):
                for value in prohibited:
                    self.assertNotIn(value, data)
                self.assertIn("NEXT_PUBLIC_API_BASE_URL", data)

    def test_client_and_proxy_fail_closed_without_api_configuration(self):
        client = (FRONTEND / "lib/api/client.ts").read_text(encoding="utf-8-sig")
        proxy = (FRONTEND / "proxy.ts").read_text(encoding="utf-8-sig")
        self.assertIn("Octalve Cloud API URL is not configured.", client)
        self.assertIn("configured.pathname", client)
        self.assertIn("SAFE_API_BASE", proxy)
        self.assertIn("if (!SAFE_API_BASE) return null;", proxy)
        self.assertNotIn('||\n  "https://api.cloud.octalve.com/api"', proxy)

    def test_bff_protects_tokens_and_origin(self):
        client = (FRONTEND / "lib/api/client.ts").read_text(encoding="utf-8-sig")
        session = (FRONTEND / "app/api/auth/session/route.ts").read_text(encoding="utf-8-sig")
        gateway = (FRONTEND / "app/api/cloud/[...path]/route.ts").read_text(encoding="utf-8-sig")
        server = (FRONTEND / "lib/api/server-session.ts").read_text(encoding="utf-8-sig")
        self.assertIn("/api/cloud", client)
        self.assertNotIn('Authorization\`, \`Bearer', client)
        self.assertIn("sessionStorage", client)  # Only to PURGE old legacy tokens
        self.assertIn('Browser JWT storage is disabled.', client)
        self.assertIn('return NextResponse.json(', session)
        self.assertNotIn('{ access, refresh }', session)
        self.assertIn('export async function POST()', session)
        self.assertIn('status: 405', session)
        self.assertIn('sameOriginRequest(', gateway)
        self.assertIn('setSessionCookies(', gateway)
        self.assertIn('clearSessionCookies(', gateway)
        self.assertIn('Token endpoints are server-only.', gateway)
        self.assertIn('import "server-only"', server)
        self.assertIn('httpOnly: true', server)
        for part in (client, gateway, session, server):
            self.assertNotIn('x-vercel-protection-bypass', part)
            self.assertNotIn('octalve-cloud-api-git-review-', part)

    def test_vercel_api_requires_persistent_database_url(self):
        settings = BACKEND_SETTINGS.read_text(encoding="utf-8-sig")
        self.assertIn("DATABASE_URL is required on Vercel", settings)
        self.assertIn("BLACKLIST_AFTER_ROTATION", settings)
        self.assertIn("rest_framework_simplejwt.token_blacklist", settings)
