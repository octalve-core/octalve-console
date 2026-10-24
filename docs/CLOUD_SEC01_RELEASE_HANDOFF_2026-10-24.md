# Octalve Cloud — SEC-01 security-release handoff and next-phase gate

**Last independently checked:** 2026-10-24.  
**Production is already working for controlled client authentication tests.** GitHub `main` = `0c58053370fde84ed14717b0688d91bb53ba359e`; Console and API Vercel Production = READY. Production Neon `br-dark-bread-b8j0gqz4` remains 48 migrations, 91 tables, 1 client account. **No SEC-01 migration is applied in Production.**

## Workstreams and authority

- [PR #5](https://github.com/octalve-core/octalve-console/pull/5) `review/cloud-sec-01-auth-hardening` → `main`: durable PostgreSQL auth-bucket table, atomic account/network rates, HMAC-based trusted BFF client identity, cleaned security logs, pruning, regression and CI. **Draft: unmerged.**
- [PR #6](https://github.com/octalve-core/octalve-console/pull/6) `review/cloud-sec-01-bff-session` → SEC-01A Review: browser same-origin API gateway, server-side access/refresh handling, HttpOnly cookies, restricted token routes and backend-authoritative dashboard routing. **Draft: unmerged.** Do not retarget/merge before the rate-limit schema gate.
- Source-of-truth for historical 48/217 Production migration digest remains `516cd378502964020838c5d23b89caf172bd1cf135677172ee85e4795892a8cd`; SEC-01A adds `accounts.0003_auththrottlebucket` and requires a *new* migration acceptance (49 migrations / 92 public tables). Do not reuse the historical Production 48-migration runner.

## Important Review-data isolation failure discovered today

Current SEC-01 Preview Neon branches were cloned from Production **after** account activity:

| Branch | Neon ID | Current verified records |
|---|---|---|
| `preview/review/cloud-sec-01-auth-hardening` | `br-divine-wave-b8a92133` | 48 migrations, 91 tables, **1 user and 3 outstanding JWT records** |
| `preview/review/cloud-sec-01-bff-session` | `br-morning-bar-b8trszqw` | 48 migrations, 91 tables, **1 user and 3 outstanding JWT records** |

These branches **are not safe synthetic-only test databases**. Never direct Preview signup, brute-force experiments, penetration tests or CI against them. Do not interpret a copied account as a newly registered Preview user.

- A fail-closed `backend/scripts/sec01_review_schema_cli.py` and `backend/tests/test_sec01_review_schema_guard.py` were added to PR #5. They reject the Production direct endpoint, pooled/wrong Review endpoints and any Review branch containing even one user or outstanding/blacklisted token, before planning or applying the incremental migration.
- The Neon project `falling-surf-50258433` reports 10/10 branches. The account-level Neon project listing shown by the connected tool does not include this project, so **do not create a substitute project under a guessed owner/organization**.
- Next administrator action: identify the authoritative Neon owner/organization and establish a *new, empty, synthetic-only* SEC-01 database. Reuse only migration definitions, never copied Production account rows, hashed passwords, sensitive profile records or JWT tables. Plan cleanup of polluted SEC-01 branches through verified ownership, dependency and retention approval; do not delete recovery branches blindly.

## SEC-01 release-blocking acceptance

1. GitHub PR #5 security, Django, frontend and disposable PostgreSQL checks all green at its **exact final head**. Assess the durable rate-limit window, identity/network behavior, 24-way concurrency, NAT grouping, fail-closed database outage and defensive logging. Confirm application startup with no rate table is deliberately blocked until migrated.
2. Securely provision a clean Review-only Django database and a separate Review API/Console environment, with distinct `DJANGO_SECRET_KEY`, `DATABASE_URL`, allowed hosts, callback domains and only synthetic users. Never use the Production pooled or direct DB URL. Public Preview protection remains enabled.
3. Apply SEC-01A's `accounts.0003` using the actual Django migration tool to the clean Preview database, after exact plan, recovery and approval checks. Independently confirm 49 migrations, 92 tables, index, no inherited users or tokens. **Do not manually insert Django ledger records.**
4. Full Preview browser matrix: signup, client login and dashboard, browser reload/session resume, logout and refresh-token replay denial, invalid credentials, 429/Retry-After, password reset, CSRF Origin/fetch metadata, denied client access to staff/admin pages and direct API routes, refresh expiry/retry concurrency, network failures and recovery. Privileged-role MFA and direct authorization remain unaccepted separately.
5. For PR #6, prove access/refresh JWTs never appear in JavaScript-visible API responses, local/session storage, analytics, browser logs or URLs; prove cookies are `HttpOnly`, `Secure`, `SameSite` and host-only, and that Next.js proxy and BFF use the same cookie names and underlying user-role authority. Test multiple tabs and simultaneous expired-token refresh against SimpleJWT rotation/blacklist, including logout after access expiry.
6. Confirm an authorized operator has reviewed cross-project client-IP forwarding trust, `X-Forwarded-For` ingress semantics, timestamp/HMAC lifecycle and replay mitigation, CORS, WAF/external rate limiting and DoS trade-offs. Do not rely on code comments alone.
7. Obtain a fresh **Production incremental migration** plan and recovery checkpoint, explicitly approve that migration on Production Neon `main`, apply it once and independently verify 49/92 **before** promoting PR #5.
8. Keep PR #6 separate. Only after PR #5 is released and stable, qualify PR #6 against the new main baseline and its end-to-end acceptance. Verify rollback of each Vercel project by immutable deployment ID without overwriting the migrated DB; confirm any old server code tolerates the additive throttle table.
9. Commercial customers remain blocked until production hosting terms, transactional email, email verification, privileged MFA, billing settlement and provisioning authority are separately accepted.

## Next business phase — after SEC-01 passes

**Cloud BIZ-01: authoritative product catalog → cart/order → pending invoice.** Inspect existing Django models, endpoints and frontend UI first; no duplicate entities. Separate payment initiation from provider-confirmed settlement. `Invoice != Receipt != Payment confirmation`. Persist an idempotent state transition to `PAID` before any provisioning. For first actual product choose one hosting plan and one adapter only. Queue provisioning after verified settlement, never from browser success responses. Build in isolated Review, qualify role isolation and cross-company record access, then promote only on separate approval.

## Approval status

**SEC-01A and SEC-01B: NOT APPROVED FOR PRODUCTION.** CI completion cannot replace clean Preview data, real browser acceptance or a separately authorized Production migration. Production baseline remains `0c580533`. The next assistant should continue from these exact repository refs, inspect authoritative live tools, and never infer success from historical notes.
