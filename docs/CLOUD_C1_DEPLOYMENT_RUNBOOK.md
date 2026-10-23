# Octalve Cloud — portable live-development deployment runbook
Date: 2026-10-23. **Review environment only.** The existing VPS subscription was deliberately discontinued; DO NOT reactivate it just to run these applications.

## 0. Deployment decision
- Octalve Console Next.js: use a Vercel preview project if the selected Vercel plan permits this company use; the connected team is currently **Hobby**, whose official terms limit use to non-commercial personal projects. If ineligible, use Render/Netlify with a compliant plan, without changing app business code.
- Octalve Django API: use Render's ordinary Python web-service process initially if a compliant, low-cost preview is needed; Vercel's Django/Python runtime is a viable alternative for short stateless API requests (GA 2026-10-15). Neither free web service is a durable provisioning worker.
- PostgreSQL: independent persistent **development** DB service; avoid free Render Postgres for durable records due to its 30-day expiry.
- Cloud public website: independent static-export project (e.g. Cloudflare Pages) and **not** the Console deployment.
- OPanel: future independent Next.js project, initially connect with scoped authorization and simulated providers.

## 1. Preserve and verify Git source
1. Verify main currently matches expected baseline `d7937e95a904148d221719a6b0f9ee056d7ef2db` or re-audit any newer changes.
2. Develop on `review/cloud-portability-security-foundation` and PR #2, do not auto-merge.
3. Run `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm typecheck:frontend`, `pnpm build:frontend`.
4. Use Python 3.12 for now, install requirements from `backend/requirements.txt`; run `python backend/manage.py check` and isolated Django tests. Pin and deduplicate Python requirements as a dedicated follow-up change before production.
5. CI run reports are proof only for their own tests; they are not proof of a running cloud deployment.

## 2. External development PostgreSQL
1. Create an empty development PostgreSQL database, with different user, credentials and resources from any production system.
2. Enable TLS, network restrictions and backups where available; do not publish connection strings.
3. Configure `DATABASE_URL=postgresql://<username>:<password>@<hostname>:5432/<database>?sslmode=require` in the host secret-management UI, not git/chat.
4. Configure a migration job that uses the **same exact reviewed commit** and environment settings, runs `python manage.py migrate --noinput`, records success, and is never automatically executed for every HTTP request.
5. Validate correct table/schema creation and user persistence across redeployment. Do not attempt to import any legacy MySQL database without a separately reviewed data migration.

## 3. Django API — Render Web Service
Source: `octalve-core/octalve-console`. Root directory: `backend`. Runtime: Python (explicit 3.12).
- Build: `pip install -r requirements.txt && python manage.py collectstatic --noinput` (check static middleware/config in review; fail deployment on actual build errors).
- Start: `gunicorn octalve_backend.wsgi:application --bind 0.0.0.0:$PORT`.
- Health: initial non-secret Django API/docs endpoint `/api/schema/`, followed by a dedicated minimal `/api/health/` when implemented.
- Required configuration: `DJANGO_SECRET_KEY`, `ENCRYPTION_KEY` (valid Fernet key if gateways used), `DATABASE_URL`, `DEBUG=false`, `FRONTEND_URL`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`.
- `ALLOWED_HOSTS`: Django backend hostnames only (comma-separated). `CORS_ALLOWED_ORIGINS`: exact trusted Console **origins** including scheme; do not use '*'. `CSRF_TRUSTED_ORIGINS`: exact origins.
- Do not use Django filebased email on ephemeral services for real verification. Configure a safe test email transport or email outbox service.
- Run `python manage.py check --deploy` on the preview configuration and address relevant findings before any external customer exposure.
- Render free web sleeps after 15 minutes idle and has no persistent local disk. Use only as a preview.
- On Vercel Python instead, create a second Git project whose root is `backend` and let Vercel detect Django; validate this project's requirements and WSGI/ASGI behavior before using it for API acceptance. Do not rely on persistent process state.

## 4. Console frontend — Vercel Next.js project
Use the **same** accessible GitHub repository, project root `frontend`, framework Next.js, Node 22 and pnpm workspace lock from the repository root. Confirm Vercel's monorepo build/install detection and align commands with the verified pnpm CI commands.
- Frontend environment: `NEXT_PUBLIC_API_BASE_URL=https://<django-review-host>/api`, `NEXT_PUBLIC_ALLOW_FALLBACK_DATA=false`, `NEXT_PUBLIC_APP_URL=https://<console-preview-host>`.
- Do not set API base to the bare host: current typed path definitions exclude `/api`.
- Review deployment: restricted/protected preview URL, no public customers, test-only accounts, no search engine indexing.
- Validate actual `/login`, `/signup`, admin/client/staff route access, API URL and CORS preflight; verify token rotation/logout, ownership failures, mobile tables, error and empty states, not just build success.
- Do not set production `console.octalve.cloud` DNS until owner approves a release.

## 5. Real backend-to-frontend API acceptance
1. Create sandbox client A, client B and privileged staff/admin through an audited, isolated setup path.
2. Use browser devtools network tab to confirm `POST /api/auth/register/` returns 201; persisted record exists in PostgreSQL.
3. Confirm `POST /api/auth/jwt/create/` returns auth, `GET /api/auth/users/me/` reflects correct user and role.
4. Wrong credentials, expired tokens, client trying to visit staff/admin sections, client A requesting client B's record, client editing a service or provisioning task all must reject.
5. Catalogue load and page error states must match actual Django responses; no fallback demo record when API fails.
6. Test plan/order/invoice creation using Django-backed business records; never use client-supplied amount as authority.
7. Test signed sandbox payment webhooks against raw body; **C1 returns pending_reconciliation**, not paid. Defer payment acceptance until atomic provider-reverified settlement exists.
8. Test simulated provisioning with success/timeout/failure and idempotency, then audit all event logs for credential leaks.
9. Cross-origin cookies and CSRF must be tested on target preview domains; do not disable protections merely to get a green screen.
10. Record deployment URL, git SHA, environment name, test run, API payload schema and screenshots; redact all credentials.

## 6. Self-host transition checklist
- Reproduce Next + Django builds using container/standard server process.
- Add reverse proxy + managed TLS; migrate Postgres with verified backups, encryption keys and tested rollback.
- Configure separate Celery/worker deployment + Redis/RabbitMQ or portable equivalent, persistent object storage and centralized observability.
- Use restricted private-network provider API credentials; no shell/root token in frontend.
- Run all same acceptance tests against migrated preview environment; then test sacrificial physical/VM account creation.
- Switch DNS only after validated security, health checks, restore plan and CEO approval.

## Reference docs
Vercel https://vercel.com/docs/monorepos  
Vercel Python/Django https://vercel.com/changelog/python-on-vercel-is-now-generally-available  
Vercel Hobby https://vercel.com/docs/limits/fair-use-guidelines  
Render Django https://render.com/docs/deploy-django  
Render free https://render.com/docs/free  
OWASP https://asvs.owasp.org/
