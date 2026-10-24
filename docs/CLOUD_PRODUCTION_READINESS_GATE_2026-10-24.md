# Octalve Cloud — Production Release Qualification Gate

**Date:** 2026-10-24  
**Source:** `octalve-core/octalve-console`; PR #4 `review/cloud-auth-token-lifecycle` → PR #3 `review/cloud-foundation-qualification` → `main`.  
**Status:** **NO GO for Production migration, merge, or public pilot.** This document records verified state and required independent approvals. It does not authorize any production action.

## Verified infrastructure (2026-10-24)

| Component | Evidence | State |
|---|---|---|
| GitHub `main` | `d7937e95a904148d221719a6b0f9ee056d7ef2db` | Older, unpromoted |
| Foundation PR #3 | Draft, `review/cloud-foundation-qualification` | Unmerged |
| Auth PR #4 | Draft, `review/cloud-auth-token-lifecycle` | Unmerged |
| Vercel Console Production | `dpl_5ag1Mnbavez5BRiDtXePAWGjzdik` | READY on old main |
| Vercel API Production | `dpl_CsmxFVgbCjhLixBKGakh8qmM2hYE` | ERROR; `DJANGO_SETTINGS_FAILED` at `DJANGO_SECRET_KEY` lookup |
| Production Vercel variables | Both projects queried by API | **Zero variables targeted at Production** |
| Neon primary `main` | `br-dark-bread-b8j0gqz4`, `neondb` | **0 public base tables** |
| Isolated Auth Review | `br-winter-bar-b87tjg9h` | 48 Django migrations, 12 blacklist migrations, 91 tables, 0 users |
| Auth Review migration | Reviewed candidate digest `516cd378502964020838c5d23b89caf172bd1cf135677172ee85e4795892a8cd` | Applied **only** in Auth Review |
| Preview API | Preview alias protected by Vercel Authentication | Health works with authorized browser; cross-origin signup/login blocked by Preview protection |
| Payments and provisioning | Existing deliberate fail-closed implementation | **Not accepted for real customers** |

## Clean production transport contract

The intended public domains are:

- Public Cloud: `https://cloud.octalve.com`
- Console: `https://console.cloud.octalve.com`
- Django API: `https://api.cloud.octalve.com` (frontend variable must end in `/api`)
- OPanel, later: `https://opanel.cloud.octalve.com`

**These are intended destinations, not a claim that DNS, certificates or Vercel project-domain ownership are configured. Verify them before release.**

The production-compatible frontend uses explicit `NEXT_PUBLIC_API_BASE_URL` in **both** browser API client and Next.js session proxy; absent, relative, stale `/api/cloud`, malformed, or non-HTTPS values fail closed (except localhost HTTP during development). Never silently route authenticated requests to a guessed or Preview-specific API.

The ephemeral Preview-only `frontend/src/app/api/cloud/[...path]/route.ts` and `frontend/src/lib/api/review-upstream.ts` were removed, and `frontend/src/proxy.ts` restored to the reviewed session-protection implementation before adding only explicit endpoint validation. There is no hard-coded Auth Review API hostname or Vercel protection credential in deployable source.

Vercel project Deployment Protection currently uses Vercel Authentication for `*.vercel.app` URLs, including Preview URLs. Public custom domains have different protection rules; check the exact project setting and effective domain policy before relying on them. **Do not disable Preview protection or expose a bypass token in the browser.** Public production authentication remains Django's responsibility; staging tests must exercise the same API and origin contract before acceptance.

## Release gates, in order

### Gate A — Code and branch qualification

- Keep PR #3 and PR #4 as drafts; run frontend, Django security, disposable PostgreSQL schema/rotation/replay/role isolation, supply-chain, and release-boundary CI.
- Verify no Vercel Preview-only bypass code, review hostname, or hard-coded temporary secret enters `main`. The regression is `backend/tests/test_cloud_production_release_boundary.py`.
- Review browser session behavior: access expiry, refresh-cookie-to-storage synchronization, logout (blacklisted refresh but signed access token can remain valid until expiry), password reset, same-origin cookie controls and CSRF.
- Separately approve accurate, reachable public Terms of Service and Privacy Policy. Frontend-only consent is not server-side legal acceptance evidence.

### Gate B — Real Production infrastructure preparation (no data copied from Review)

- Establish an independently backed-up Production Neon database and durable restore procedure. The current primary Neon `main` is empty. Never point a Production deployment at Auth Review or Foundation Preview.
- Confirm exact Production Neon project/branch, direct host, `neondb`, role, SSL/TLS, current schema, recovery point/branch, data retention and operating limits; test restore mechanics before an irreversible migration.
- Prepare **a new Production-specific migration plan and explicit typed authorization gate**. Independent operator revalidates the exact plan (expected 48/217 only if source is unchanged), migration graph, fingerprint, target, empty schema and backup. Do **not** reuse the `apply-neon-auth-review.ps1` Review-only approval or target.
- Apply Production migrations **only after explicit, separate owner authorization**; independently verify the Django ledger, token tables/constraints, migration count and expected schema. Do not apply migrations at Vercel build or request time.
- Create Production Vercel variables on the **intended projects only**, never Preview values:

  API `octalve-cloud-api` — `DATABASE_URL` (Production-only Neon), `DJANGO_SECRET_KEY` (strong unique value), `ENCRYPTION_KEY` if required by enabled features, `DEBUG=false`, `ALLOWED_HOSTS`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, production-capable `EMAIL_BACKEND`, and security-related settings as qualified.

  Console `octalve-console` — `NEXT_PUBLIC_API_BASE_URL=https://api.cloud.octalve.com/api` **only after this host is confirmed live**, `NEXT_PUBLIC_APP_URL=https://console.cloud.octalve.com`, `NEXT_PUBLIC_ALLOW_FALLBACK_DATA=false`.

  Audit effective values and scopes without copying any passwords/URLs containing credentials into chat, commits, CI logs or screenshots.

- Verify Vercel custom-domain ownership, DNS, HTTPS certificates and canonical redirect behavior for each independent project; ensure the API's production URL is actually reachable by real browsers and CORS allows **only** approved Console origin(s). `GET /api/health/` tests liveness only, not database readiness.

### Gate C — Qualify and release

- Before promotion, stage a **Production-configured build without assigning the customer domain**, confirm its exact commit, branch, assets, environment and API access. A protected staging URL can require Vercel CLI access; use a securely authorized browser/staging origin for CORS validation instead of declaring it passed from an isolated GET.
- Complete live signup → login → /me → protected client dashboard → refresh/token replay rejection → logout → unauthorized admin/staff denial using synthetic data and a Production-isolated pilot account only after the database and legal gates. Verify desktop and mobile, expired cookies, password reset, sensitive headers, and audit logging.
- Keep billing settlement, paid checkout, webhooks, domain lifecycle and server provisioning **disabled** until each has its own durable provider-confirmed authority and rollback acceptance.
- Merge Foundation PR #3 into `main` only after Gate A/B allow promotion. PR #4 targets PR #3; after Foundation merge, update and independently verify the auth PR target/diff and gate results, then merge only after explicit final approval. No auto-deploy of an unqualified `main` release.
- Track deployment IDs and migration attestation; monitor errors; publish approved domains only after health, security and user-flow acceptance. Rollback application deployments using retained known-good assets, **not** automatic Neon branch reset. Database rollback requires independently validated restoration steps.

## Current blocking items

1. No Production Vercel environment variables in either project.
2. Production API's current build fails reading Django settings (missing `DJANGO_SECRET_KEY` observed); it has not reached a verified operational state.
3. Neon Production primary has no schema. Production migration and recovery are unapproved and unexecuted.
4. Intended production domain binding, TLS, legal publication, email delivery and real browser acceptance are unverified.
5. Preview-only external cross-origin auth remains unsuitable for qualifying production. The temporary bridge has been deleted from **source**; its now-unused Preview environment secrets and temporary automation bypass entries require scoped inventory and careful revocation after verifying no dependent jobs.
6. Hosting/provisioning and payment flows remain noncommercial; do not infer that an auth release authorizes them.
7. Confirm the current Vercel/Neon service tiers and commercial-use/retention restrictions before accepting paying customers.

**Decision:** Finish safe code cleanup and CI now. Preserve Review and Production data separation. Do not merge PR #3/#4, apply Production schema, change public DNS, or enable commercial traffic until the recorded gates pass.
