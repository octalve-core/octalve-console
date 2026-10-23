# Octalve Cloud C2 — canonical domain and live deployment acceptance
**Date:** 2026-10-23; **scope:** review branch only, no DNS mutation and no production release.

## Decisions from owner
Canonical public website `https://cloud.octalve.com`; Console `https://console.cloud.octalve.com`; OPanel `https://opanel.cloud.octalve.com`; use `https://api.cloud.octalve.com/api` as proposed Django API address after approved deployment.
Legacy links `octalve.cloud`, `console.octalve.cloud`, `opanel.octalve.cloud` remain available; redirect **browser navigations** once verified. Do not redirect raw API operations, POST webhooks or OAuth callbacks blindly.

## Existing source and C2 modifications
- Django `GET /api/health/` is a safe *liveness only* response, not a database, readiness or provider health indicator. No secret or host data is returned.
- The Console middleware fallback now references canonical API path `https://api.cloud.octalve.com/api`, with explicit `NEXT_PUBLIC_API_BASE_URL` still required in actual preview. Do not treat a fallback as proof of live API.
- Console signup legal URLs use the public .com site.
- Public Cloud website `cloud-links.ts` now defaults Console/OPanel links to canonical .com and permits environment URL overrides for isolated preview testing.
- No cookie sharing across the three hostnames: use existing `__Host-` cookies on Console and a verified, service-scoped OPanel handoff in a later batch.

## Intended deployment host configuration (do not set guessed DNS)
Frontend `NEXT_PUBLIC_API_BASE_URL=https://<confirmed Django host>/api`, `NEXT_PUBLIC_APP_URL=https://<confirmed Console host>`, `NEXT_PUBLIC_ALLOW_FALLBACK_DATA=false`.
Backend `DATABASE_URL=postgresql://<...>/?sslmode=require`, `DJANGO_SECRET_KEY`, `ENCRYPTION_KEY`, `DEBUG=false`, `FRONTEND_URL=https://<confirmed Console host>`, `ALLOWED_HOSTS=<exact API hosts>`, `CORS_ALLOWED_ORIGINS=https://<exact Console host>`, `CSRF_TRUSTED_ORIGINS=https://<exact Console host>`.
All secrets stored only through protected host settings; do not commit them or post them in chat.
For first-party canonical domain deployment, adjust these values to the canonical hosts **only after they resolve and certificate/HTTPS readiness is verified**.

## Browser-only integrated acceptance journey
Start at the public homepage; follow **Get Started** with an actual click (new tab if the UI opens one); click **Create account**, then **Login**, fill test account credentials and submit; continue to client dashboard via authenticated UI navigation. Later extend the same journey through catalogue, cart/order/invoice, gateway sandbox payment and simulated provisioning, returning to service management and OPanel via actual buttons. No direct deep-page requests or API calls for browser acceptance. Independent Django unit/API tests remain engineering checks but are not substitutes for browser acceptance.

## Constraints and release blockers
- No authorized Vercel project can currently be created via the connected team: 403 permission denied. No connected Render hosting service and no isolated online Postgres available yet.
- Existing public website reported at `cloud.octalve.com` by user, but it could not be fetched through this environment and is not verified by browser evidence here.
- Repository `octalve-core/octalve-opanel` does not currently exist; must be created as an empty private repo by owner before OPanel scaffold.
- CI liveness/unit checks, build/typecheck and local Chromium static-site journey are verification only; do not claim live cross-host integration until genuine URLs and browser trace are available.
- No unapproved DNS changes, commercial gateway keys, customer data, branch merging or migration.
