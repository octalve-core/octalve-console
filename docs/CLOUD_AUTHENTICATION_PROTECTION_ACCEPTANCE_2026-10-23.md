# Octalve Cloud — canonical-domain and authentication acceptance blockers
**Date:** 2026-10-23 | **Status:** REVIEW, not a qualified production release.

## Exact verified source and deployment scope
- `octalve-core/octalve-console` PR #3, `review/cloud-foundation-qualification`, source at `50288b36568956b0d56df9f14638ad5f0ec1f3e5` before this documentation commit.
- Console Vercel project `octalve-console`; Django Vercel project `octalve-cloud-api`. Both Preview deployments have reported READY from reviewed source. Production `main` and live DNS remain untouched.
- Both Vercel projects have `ssoProtection.enabled=true`, `deploymentType=all_except_custom_domains`, so their .vercel.app Preview URLs are protected.
- An isolated read-only HTTP diagnostic from a temporary inspection sandbox confirmed that GET to the Console Preview login URL **redirects to a Vercel authentication page**, not the Console login screen.
- The same diagnostic sent an OPTIONS preflight (Origin: Console Preview, Access-Control-Request-Method: POST, Access-Control-Request-Headers: content-type) to `/api/auth/jwt/create/`. Vercel responded `302` to its login service with **no Access-Control-Allow-Origin**. This is a verified CORS/preflight blocker. No API mutations or user account operations were made.
- Authenticated access helper in the connected Vercel tool returned `403 Forbidden` for its protected deployment share endpoint. Do not infer that protected Preview access can be automated with the current connector scopes.

## How to enable authorized browser testing WITHOUT disabling deployment protection
1. Owner signs into Vercel with the account that has access to both projects and opens the existing protected Console preview. For external testers, Vercel provides restricted Shareable Links, but these are access credentials and must not be placed in public source or CI logs. Use expiry and revoke when complete.
2. In **octalve-cloud-api → Settings → Deployment Protection → OPTIONS Allowlist**, add the most limited path prefix supporting auth preflight: `/api/auth/` (verify the effective UI path-match rule and keep application writes protected). This is a **Vercel project setting** and can affect environments beyond review; obtain owner confirmation before changing it. Do not make unauthenticated GET/POST/PUT/PATCH/DELETE accessible.
3. Verify Django `CORS_ALLOWED_ORIGINS` exactly matches the real Console Preview origin. Do not use `*`; confirm CSRF and session boundaries.
4. Verify the response to a normal **browser-originated** signup/login OPTIONS is successful, and then check the actual POST only through the visible form. This does NOT prove Neon migrations were applied.

## Neon Preview schema acceptance (NOT performed)
- Vercel API Preview contains `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Only environment metadata was inspected.
- A READY API deployment or health response does not confirm the Django migration ledger.
- Protected engineering runner: branch `review/cloud-foundation-qualification`; restricted Codespaces secret `CLOUD_REVIEW_DATABASE_URL_UNPOOLED`, connected only to the isolated Neon Preview DB. Run `bash backend/scripts/run_review_migrations.sh plan` first.
- **User explicitly requires inspecting the actual plan and separate authorization before any `apply`.** Do not run `migrate` against Neon in a build, web request or unattended worker. Preserve safe backup/rollback plan.

## Canonical route and public homepage
- Desired public: `https://cloud.octalve.com`; Console: `https://console.cloud.octalve.com`; API: `https://api.cloud.octalve.com`; OPanel: `https://opanel.cloud.octalve.com`.
- Review public Cloud source defaults Console/OPanel to these .com addresses, but the presently deployed public homepage still points Get Started to `https://console.octalve.cloud`, which fails browser navigation.
- No public DNS, domain alias, production website build or `main` branch has been changed. The alternate **local static-export review browser build** can point to the Vercel Console preview URL for testing, but it is still Vercel-protected. Do not publish a protected-share URL as a public link.
- If `octalve.cloud` is later purchased, redirect browser navigations at the domain host; DNS records alone are not HTTP redirects, and POST callbacks/webhooks should not be blindly forwarded.

## Legal and tester-safety gate
- Console signup links now target `https://cloud.octalve.com/terms-of-service` and `https://cloud.octalve.com/privacy-policy`; those pages **are not implemented in the public Cloud repository**. They must be accurately drafted, approved and actually published before inviting external account registrants.
- Test-only internal accounts should use synthetic test data and no real payments or host changes.
- Neon Free and Vercel Hobby limits and terms remain relevant for pilot/commercial use.

## Release decision
**NO GO** for main merge/customer pilot until: reviewed Neon migrations completed; protected access plus CORS preflight works; visible browser registration/login/logout/permissions passes on desktop/mobile; proper legal pages exist; owner authorizes exact production release.
Reference: Vercel Deployment Protection / Trusted Sources / OPTIONS Allowlist documentation. 
