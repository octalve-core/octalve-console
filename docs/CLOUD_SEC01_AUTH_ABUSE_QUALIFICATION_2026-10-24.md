# Octalve Cloud — SEC-01 Authentication Hardening Qualification

**Date:** 2026-10-24  
**Production baseline:** `main` at `0c58053370fde84ed14717b0688d91bb53ba359e` (Console + API READY; eight browser acceptance checks reported by owner).  
**Scope:** Draft PR #5 `review/cloud-sec-01-auth-hardening` → `main`; dependent BFF session PR #6 is separate and must be requalified.  
**Release status:** **REVIEW ONLY — NO Production merge or schema migration.**

## Attack analysis and implementation

- DRF's built-in rate throttling is cache-based and non-atomic; it cannot be considered a brute-force security boundary. An ephemeral per-function Vercel counter is insufficient. See https://www.django-rest-framework.org/api-guide/throttling/
- SEC-01 middleware `accounts.security_throttle.AuthAbuseLimitMiddleware` uses durable PostgreSQL `AuthThrottleBucket` entries; each request increments its row under a transaction and `select_for_update()`. The row fingerprint is an HMAC-SHA256 of the scope/identifier, keyed with Django's secret. Raw emails or IPs are not saved to the throttle table.
- Rate windows are current first-pass defaults, to validate under realistic load before enabling for all customers:
  - Login: **30 per 5 minutes per IP**, **8 per 15 minutes per email/username**. Counts attempts, including successful logins, to guarantee the worst-case burst cap. Deliberate DoS via attempted logins is a risk and must be measured.
  - Registration: **5 per hour per IP**.
  - Password-reset request: **8 per hour per IP** plus **4 per hour per email**.
  - Password-reset confirmation: **12 per hour per IP**.
  - JWT refresh: **120 per hour per IP**.
- Vercel replaces `X-Forwarded-For` at ingress, allowing its value to be used on *verified Vercel deployments only*. On local/self-hosted requests use `REMOTE_ADDR`. Cloudflare proxy placement requires an independent origin/IP trust review. See https://vercel.com/docs/headers/request-headers
- 429 returns `Retry-After`, a generic JSON message and `Cache-Control: no-store`. Authentication endpoints fail closed with 503 if shared database rate storage is unavailable.
- Limits are applied to exact canonical POST paths. Broader application/WAF protection is still needed against credential stuffing, distributed source IP rotation and DoS. OTP and MFA are separate future controls.

## Incremental migration — new authority

**New:** `accounts.0003_auththrottlebucket` creates one auth bucket table. **Never run the original 48-migration Production runner on this new source**, and never alter the recorded historical digest `516cd378502964020838c5d23b89caf172bd1cf135677172ee85e4795892a8cd`.

- Production currently has **48 applied migrations and 91 tables**. SEC-01 would create **49 migrations and 92 tables**, subject to independent verification and explicit authorization.
- CI requires the historic 48/217 digest remain intact and executes full current schema on **disposable PostgreSQL**, with real API regression tests and a concurrent 24-request throttle probe.
- No SQL has been applied by this phase to `br-dark-bread-b8j0gqz4` (Production Neon main), `br-winter-bar-b87tjg9h` (isolated Auth Review), or any live customer data.

## Deployment order and acceptance gates

1. Review and accept PR #5 CI, including PostgreSQL concurrency and anti-enumeration tests.
2. Provision an isolated Preview branch with its own database, apply the **incremental** migration through a separately approved migration gate (not Vercel build/runtime), and inspect table, index and lock behavior. The previously used protected API Preview cannot be assumed browser-accessible from the Console due to Vercel Authentication.
3. Validate shared client NAT/IP behavior, benign login retry budgets, distributed brute-force resistance, retry windows, reset and refresh limits, error/CSRF/CORS, and log redaction.
4. Issue a fresh, separately authorized Production migration plan and recovery snapshot. Never reuse an old 48/217 `-Apply` approval or hardcoded Review migration wrapper.
5. Apply 49th migration to Production only after a successful recovery drill, *before* deploying code that uses the new table. Keep auth traffic on the current stable application during migration.
6. Promote PR #5 only after schema and release acceptance. Independently verify login/signup/current-user/refresh/logout and admin/staff denials on synthetic data; allow rollback without resetting the entire Neon branch.
7. Separately qualify PR #6 browser-session BFF. It removes token-bearing JS storage and adds a same-origin API gateway, but needs rigorous cookie/CSRF/session/refresh concurrency and browser regression. **Do not merge both PRs together without separate gates.**
8. Later phases: credential provider, password recovery and email verification (current file-backend unsuitable for Production), privileged account MFA, security event aggregation, request-based monitoring, durable session design and automated cleanup of expired throttle rows.

**No automatic Production release, commercial launch or unconditional security certification is granted by this report.**
