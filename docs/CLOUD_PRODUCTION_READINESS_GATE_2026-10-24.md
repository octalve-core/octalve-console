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


## Infrastructure preparation addendum — 2026-10-24 (independently rechecked)

This records **preparation only**; it does not change the NO GO decision above.

### Completed without production deployment

1. Vercel `octalve-cloud-api` (`prj_iFSbPGawzM1peDZDYw8AnDCYBvbz`): Production-scoped plain variable `DEBUG=false` **created, then read back and verified**.
2. Vercel `octalve-console` (`prj_CqAeZgrQPFXrNFFZTMnMkUhijQua`): Production-scoped plain variable `NEXT_PUBLIC_ALLOW_FALLBACK_DATA=false` **created, then read back and verified**.
3. Neon `falling-surf-50258433` primary `br-dark-bread-b8j0gqz4` (`main`, database `neondb`) rechecked **zero public base tables**; no migration has run.
4. Neon no-compute checkpoint `br-wild-sea-b8dy0nsz`, named `backup/pre-cloud-production-schema-2026-10-24`, created as a child of **primary main**, then checked `ready`. It captures a pre-migration state; it is **not a continuously updated backup**, and its restore procedure has **not** been tested. Create/verify a current recovery point again immediately before an authorized production migration.
5. GitHub `main` and both draft PRs remain unmerged. No Vercel Production deployment or Cloudflare DNS changes were made.

### Domain control check

- Vercel Octalve Vault team reports **no parent `octalve.com` domain** in its list. Reading the parent as a team-owned domain returned **403 permission denied**. Do not assume the team controls it.
- The current domain lookup reports external DNS name servers `max.ns.cloudflare.com` and `phoenix.ns.cloudflare.com`. **Do not change parent/apex records or create Vercel project bindings without verified authority**.
- Required Console hostname `console.cloud.octalve.com` and API hostname `api.cloud.octalve.com` are **not currently attached** to their Vercel projects. Ownership verification, exact CNAME/TXT records, SSL and end-to-end browser routing remain gated.

### Hosting plan check — commercial release blocker

- The connected Vercel team `octalve-vault` reports the **Hobby** plan. Vercel's currently published Hobby terms restrict it to personal/non-commercial use: https://vercel.com/legal/terms and https://vercel.com/docs/limits/fair-use-guidelines.
- **Do not accept paying Octalve Cloud customers on this Vercel Hobby deployment.** Choose a contractually permitted paid Vercel plan or a different production host whose current terms explicitly permit the intended commercial workloads. Non-commercial private qualification may continue under applicable terms.
- Neon Free provides 10 branches per project and limited restore history. The new no-compute checkpoint consumes a branch slot. Verify remaining allowance and actual backup/restore requirements before increasing load or migration: https://neon.com/docs/introduction/plans.

### Credentials intentionally NOT created or guessed

- API Production: `DJANGO_SECRET_KEY`, `DATABASE_URL` for the **primary or separately approved Production database**, `ENCRYPTION_KEY`, verified `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL`, and a real production email provider are still missing.
- Console Production: `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_APP_URL` remain unset until the authorized canonical endpoints have been attached and verified. Never point them at `/api/cloud`, a protected Preview alias, or a Review Neon database.
- No secrets are included in source or this report. Set any newly generated secrets **directly as Production-only Sensitive/Encrypted variables in the correct Vercel project**, and audit values/targets privately without exposing them in logs.

### Next operator action gate

1. Verify whether `octalve.com` is owned in Cloudflare and that the correct team can add the two intended subdomains. Inventory existing records **before** requesting changes.
2. Resolve the commercial hosting entitlement and choose the deployment target.
3. Establish an appropriate Production database protection/restore plan, verify a new recovery point and its restoration method, and authorize the exact Production migration plan separately. **Do not run the Auth Review migration wrapper against Production.**
4. Add only approved Production-scoped secrets and verified domain settings. Stage a deployment without public promotion; test Django health **and database readiness**, browser auth lifecycle and legal/email flows. Payments and provisioning remain disabled.


## Domain assignment preparation — 2026-10-24 (subdomains only)

**Owner instruction:** prepare existing Vercel Production projects for domain binding; the domain owner will edit Cloudflare. **This does not authorize migrations or an unqualified public release.**

- Vercel project `octalve-console` (`prj_CqAeZgrQPFXrNFFZTMnMkUhijQua`): `console.cloud.octalve.com` attached, currently **unverified** (requires Cloudflare TXT ownership challenge and DNS).
- Vercel project `octalve-cloud-api` (`prj_iFSbPGawzM1peDZDYw8AnDCYBvbz`): `api.cloud.octalve.com` attached, currently **unverified** (requires Cloudflare TXT ownership challenge and DNS).
- The two subdomains currently have **no CNAME/A records** in Vercel's DNS diagnostics. Parent `cloud.octalve.com` has an existing external destination; **do not change it**.
- DNS provider identified as Cloudflare: `max.ns.cloudflare.com` and `phoenix.ns.cloudflare.com`. Each subdomain's recommended CNAME destination is `cname.vercel-dns.com`; DNS owner must inspect existing records first. Vercel's project-domain API provides a separate `vc-domain-verify` TXT challenge for each subdomain at `_vercel.octalve.com` (read the current value at verification time rather than committing challenge tokens to source).
- API **Production-only** plain variables now set: `DEBUG=false`, `FRONTEND_URL=https://console.cloud.octalve.com`, `ALLOWED_HOSTS=api.cloud.octalve.com`, `CORS_ALLOWED_ORIGINS=https://console.cloud.octalve.com`, `CSRF_TRUSTED_ORIGINS=https://console.cloud.octalve.com`.
- Console **Production-only** plain variables now set: `NEXT_PUBLIC_ALLOW_FALLBACK_DATA=false`, `NEXT_PUBLIC_APP_URL=https://console.cloud.octalve.com`, `NEXT_PUBLIC_API_BASE_URL=https://api.cloud.octalve.com/api`.
- Production Django `DJANGO_SECRET_KEY`, Production `DATABASE_URL`, `ENCRYPTION_KEY` if feature-required, real production mail setup, and explicit database migration approval **remain missing**. The Neon primary `main` still has no Django tables. No DB migrations or releases ran during this preparation.
- **Deployment decision: blocked.** A new production-target deployment would either fail Django settings initialization or expose a nonfunctional signup/login experience. Never point Production at the working Auth Review database as a workaround. Keep the existing Production deployments and both draft PRs unchanged until schema and secret gates are satisfied.


## Production authentication execution update — 2026-10-24

**Owner objective:** Production-domain internal authentication trial, including signup, login, logout, refresh and user-role dashboard routing; **not** the acceptance of paid users.

### Independently completed by the connected apps

- Both `console.cloud.octalve.com` and `api.cloud.octalve.com` are attached and verified in Vercel. Domain verification does not demonstrate application health.
- Vercel API **Production-only Sensitive** variables are now set: `DATABASE_URL` (Neon primary `br-dark-bread-b8j0gqz4` / `main`, `neondb`, pooled TLS connection) and `DJANGO_SECRET_KEY` (unique secret produced using cryptographic PostgreSQL UUID generation). Values were never put in source code or output; their actual plain text is not shown.
- Existing API production-only `DEBUG=false`, `ALLOWED_HOSTS`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` and Console `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ALLOW_FALLBACK_DATA=false` remain set.
- OWASP-focused hardening in Review source: account-locked/inactive logins no longer distinguish themselves from invalid identities, and Djoser no longer reveals whether a password-reset address exists. Backend security regressions were added.
- Created `backend/scripts/production_auth_schema_migration_cli.py` and `scripts/apply-neon-production-auth.ps1`. They require the **Neon primary direct endpoint**, strict TLS, exact database/role, zero existing tables, the source-pinned 48-migration/217-operation plan and digest `516cd378502964020838c5d23b89caf172bd1cf135677172ee85e4795892a8cd`, recovery-branch acknowledgement `br-wild-sea-b8dy0nsz`, and **interactive typed Production authorization**. No automatic migrations from CI, builds or serverless functions.
- Attempting to create a disposable Vercel Sandbox to run this command returned **403, not permitted** for the connected team. Consequently the migration has **not** been run; CI's disposable PostgreSQL migration cannot substitute for Production.

### Exact remaining critical path — operator-controlled execution

After `security`, `django-check`, `frontend` and `postgres-auth-schema` GitHub checks all pass at the exact intended commit:

1. Using the local checkout `octalve-core/octalve-console`, check out `review/cloud-auth-token-lifecycle` and fast-forward it. Keep the worktree clean.
2. Open https://console.neon.tech → project `falling-surf-50258433` → `main` branch → `neondb` → Connect. Select **direct** (not pooled) connection; copy it without revealing it to anyone. It must point to `ep-cool-butterfly-b8jvzofp.c-14.us-east-1.aws.neon.tech`. **Do not use the Auth Review endpoint**.
3. In PowerShell at the repository root:
   ```powershell
   .\scripts\apply-neon-production-auth.ps1 -PlanOnly
   ```
   Verify the 48/217 SHA-256 check. This creates no tables.
4. If recovery checkpoint `br-wild-sea-b8dy0nsz` still reflects the database's pre-migration state and the plan passes, run:
   ```powershell
   .\scripts\apply-neon-production-auth.ps1 -Apply
   ```
   The runner prompts for the direct URL (hidden) and requires the exact typed phrase displayed by the runner. **Never paste the connection string, Django signing key or tokens into chat**. The script independently verifies counts on completion.
5. Read back the Neon primary ledger, 12 blacklist migrations, 91 public tables and constraints through a separate read-only connection. If the migration fails mid-way, do **not retry blindly**.
6. Only after Production database qualification, resolve email sender, legal terms, actual commercial hosting entitlement and browser auth acceptance. Promote PR #3 then PR #4 in the correct order, staging tested Production builds before alias assignment when possible.
7. The code currently retains compatibility token storage in `sessionStorage` as well as HTTP-only cookies. This is not the preferred OWASP long-term server-only BFF/session architecture; do not advertise an XSS-proof session implementation. Logout blacklists refresh JWTs but does not immediately invalidate existing access JWTs for their full 60-minute lifetime.

**Release remains NO GO for a public customer signup or paid services until the Production schema and security/legal gates are satisfied.**
