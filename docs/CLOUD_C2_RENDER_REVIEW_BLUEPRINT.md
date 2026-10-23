# Cloud C2 — Render optional two-service review deployment
**Read before using** `render.yaml`. The Blueprint is **review only**, not a commercial release.

## Why a Blueprint
The connected Vercel team refused creation of an additional project with 403. The Render connection is not yet authorized, but the portable Next.js/Django architecture can be deployed on Render without a rewrite. Official spec: https://render.com/docs/blueprint-spec.

## One-action service preparation
1. Connect a Render workspace and authorize the private `octalve-core/octalve-console` GitHub repository.
2. Import the root `render.yaml` Blueprint on branch `review/cloud-portability-security-foundation`. Inspect all service names, plans, manual deployment triggers and environment fields before creating anything.
3. Configure **dedicated persistent external development PostgreSQL**, not the expiring Render free PostgreSQL plan.
4. Provide all secret values through the Render dashboard. Set `DJANGO_SECRET_KEY`, `ENCRYPTION_KEY` (Fernet-compatible), `DATABASE_URL` (TLS), `FRONTEND_URL`, exact backend `ALLOWED_HOSTS`, exact frontend CORS and CSRF origins. Never put secrets in the Blueprint.
5. Verify the Django host and Console host are actually created, then set `NEXT_PUBLIC_API_BASE_URL=https://<actual-api-host>/api` and `NEXT_PUBLIC_APP_URL=https://<actual-console-host>`. Trigger an explicit Console build so the browser has the proper compiled URLs.
6. Run migration separately against the isolated development database on a controlled machine or review-only GitHub workflow with approved secrets. **Do not** run database migrations inside every web boot or build. Render free services do not provide one-off commands or SSH, and the `preDeployCommand` feature is paid-service-only.
7. Protect review access; do not admit real customers. Do not enable gateway live keys or real provider credentials.
8. The API `GET /api/health/` is **liveness only** and does not confirm database readiness. Prove real account persistence through browser signup/login after migration.
9. Run a continuous Chromium customer journey beginning at the Cloud public homepage, clicking **Get Started**, entering Console, navigating signup/login and then visible business pages.
10. Confirm exact hostnames + TLS + expected redirects before attaching `console.cloud.octalve.com` or `api.cloud.octalve.com`. Do not change current DNS without owner approval.

## Operational limits and safety
- Both Render free web instances may spin down after 15 minutes; cold starts are expected. Do not interpret this as permanently running production.
- Local file storage and file-based emails are ephemeral; use external storage and a test email provider for those flows.
- Background Celery processing is not included in these two web services. Do not claim provisioning works until separate worker, locks and adapter tests pass.
- Free Render web instances do not support SSH/shell or one-off jobs. Keep migrations/manual jobs separate.
- This review deliberately disables automatic deployment and preserves the retired VPS workflow for an eventual Octalve-owned server.
- The review frontend may alternatively be moved to an eligible Vercel plan; the Django backend can remain on Render temporarily with exact CORS and stable `NEXT_PUBLIC_API_BASE_URL`.
