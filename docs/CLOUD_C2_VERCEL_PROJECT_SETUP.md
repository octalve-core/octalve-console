# Octalve Cloud — Vercel configuration (review/development only)
Date: 2026-10-23. This document contains no live deployment or secret values.
The connected Vercel team returned HTTP 403 on project creation. Only the
authorized team owner can complete creation; do not reuse Octalve Invoice.

## Prerequisites
1. Resolve project-creation privileges for the intended team or create the
   projects in Vercel's UI using your authorized account.
2. Verify that the selected Vercel plan permits Octalve's intended business
   development use; the Hobby plan terms limit commercial use.
3. Prepare a **distinct, persistent development PostgreSQL database** with a
   TLS-required connection URL; do not use ephemeral SQLite or production DB.
4. Configure a separate controlled migration job. No Django migrations at
   build time, cold start or inside a browser acceptance test.
5. Decide a protected review hostname before attaching public .com domains.

## Project 1 — Octalve Cloud Console
- Repository: `octalve-core/octalve-console`
- Project name: `octalve-cloud-console`
- Framework: Next.js
- Root directory: `frontend`
- pnpm workspace root contains `pnpm-lock.yaml` and `pnpm-workspace.yaml`;
  use Vercel monorepo detection, verify resolved root and install command.
- Preview Git ref: `review/cloud-portability-security-foundation`; inspect
  the preview URL and SHA before taking it as evidence.
- Required public environment variables: `NEXT_PUBLIC_API_BASE_URL` must
  contain the actual backend **origin plus /api**, e.g.
  `https://<api-preview-host>/api`; `NEXT_PUBLIC_APP_URL` actual Console
  HTTPS origin; `NEXT_PUBLIC_ALLOW_FALLBACK_DATA=false`.
- Keep sensitive database, provider and payment secrets out of frontend env.
- Use deployment protection; authenticated preview access must also be
  accounted for in automated browser tests.

## Project 2 — Octalve Cloud API
- Same repository; project name `octalve-cloud-api`
- Framework: Django/Python (native runtime support; no need to create a
  shadow Next.js API or move Django into `frontend/`).
- Root directory: `backend`
- Review ref: `review/cloud-portability-security-foundation`
- Required secure environment values: `DJANGO_SECRET_KEY` (strong random),
  `ENCRYPTION_KEY` (independent Fernet key), `DATABASE_URL` (PostgreSQL TLS),
  `DEBUG=false`, `FRONTEND_URL`, `ALLOWED_HOSTS` (API hostnames),
  `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` (exact Console origins),
  and authorized test email delivery.
- Inspect builds for Django's nonportable filesystem operations; operational
  logs now use stdout/stderr rather than writing to a read-only code folder.
- `/api/health/` signals liveness ONLY. It does not prove SQL migrations,
  persistent accounts, email, payments or provisioning.
- Hosted uploads must use external object storage, not local `MEDIA_ROOT`.
- Vercel Python functions are request/response workloads, not traditional
  persistent Celery workers. Do not run privileged provisioning in the API.
- Existing MySQL configuration is preserved for a future explicit migration;
  do not read or modify any legacy production DB.

## Domain mapping **after** review
- `cloud.octalve.com` public website (already live per browser verification).
- `console.cloud.octalve.com` maps to Console project.
- `api.cloud.octalve.com` maps to Django project.
- `opanel.cloud.octalve.com` maps to independent OPanel project (not yet
  implemented).
- Old `*.octalve.cloud` browser aliases can redirect after destination
  certificates, callbacks, sessions and path preservation have been tested.
- Do not point DNS records at guessed IPs or repurpose current production
  domains. Use deployment provider's exact verification records. Never expose
  Octalve Invoice endpoints as an interim Console.

## UI-only end-to-end test (no bypasses)
Start at real `https://cloud.octalve.com`, click Get Started, see Console login,
click Create account, fill and submit the form with test-only credentials, follow
the resulting authenticated UI to first dashboard. Continue only by clicking
reachable menus, buttons and forms. Record screenshots, network failure visible
to the browser (not direct API tests) and exact deployed commit. Do not inject
tokens, alter DB manually, use Playwright request, or directly goto deep pages.
Do separate Django ORM/HTTP integration tests outside the browser acceptance run.

## Evidence gates
- Preview accessible via actual URL (not a claimed deployment).
- Django on PostgreSQL, migration version verified, test user survives restart.
- Auth cookie/session and CSRF/CORS observed end to end.
- Cloud->Console browser clicks, signup/login/logout and negative access tests.
- Render or other low-cost host may replace Vercel if access/plan prevents
  proper use; application logic and migration contracts remain unchanged.

Official documentation:
https://vercel.com/docs/monorepos
https://vercel.com/docs/frameworks/backend/django
https://vercel.com/docs/limits/fair-use-guidelines
