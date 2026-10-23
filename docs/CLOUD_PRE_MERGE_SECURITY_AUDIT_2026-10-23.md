# Octalve Cloud — release / merge readiness audit
**Date:** 2026-10-23  
**Scope:** `octalve-core/octalve-console` PR #2, `octalve-core/octalve-cloud` PR #1, Vercel Console/API projects, Neon Preview integration.  
**Decision:** **NO-GO for merging both PRs to `main` as currently constituted**. No approval to promote or modify canonical DNS.

## Verified foundations
- Console PR #2 head at audit start: `555cab72bf88e005660cdefb3127762d1d8118cf`; main `d7937e95a904148d221719a6b0f9ee056d7ef2db`. More recent audit-only CI commits may have advanced review head.
- Cloud public PR #1 head: `5af0d6d10c6459332f374706c79593065783fc5f`; main `162544f07c42bb4e580ce64e9c59170ce66fe752`.
- Both PRs are **draft**. GitHub reports Console `mergeable_state=clean`, public Cloud `mergeable_state=unstable`. Mergeability is NOT security acceptance.
- Console frontend CI typechecks/builds; Django source test suite exercises isolated signup/login/permissions/signature cases. Real Django/Neon browser acceptance has **not** passed.
- New CI gate: `python manage.py makemigrations --check --dry-run` reports **No changes detected** on reviewed source.
- New CI gate: `python manage.py check --deploy --tag security --fail-level WARNING` fails with `security.W004` (HSTS) and `security.W008` (HTTPS redirect/proxy). Resolve with verified Vercel TLS/reverse-proxy configuration rather than blind flags. CI check uses a long synthetic signing key; no live secret is present.
- Neon `DATABASE_URL` and unpooled URL are scoped **Preview** on Vercel API project. No production database/variables have been configured for that API.
- The reviewed Vercel API and frontend deployment builds reached READY. READY is not proof of schema migrations, real auth, end-to-end commerce or permissions.
- The initial Cloud browser test clicks Domains/Hosting successfully. The real public `Get Started` journey failed with browser destination `chrome-error://chromewebdata/`; the test used `continue-on-error: true` so a green overall workflow masked this failure.

## Unresolved blockers, ordered by criticality
| Priority | Fact demonstrated in source/configuration | Required repair/evidence |
|---|---|---|
| **Critical** | Vercel API keys, `DATABASE_URL`, `ALLOWED_HOSTS`, CORS and CSRF are scoped only to Preview. `main` on Production would not inherit them. | Decide commercial hosting entitlement and secure production/pilot setup. Create separate pilot PostgreSQL DB and Vercel production env with own secrets. Verify migration/rollback before any merge. |
| **Critical** | `PaymentInitializeView` can initialize a gateway but signed webhooks and redirect verification are intentionally quarantined pending reconciliation; paid state is NOT authoritative. Timestamp-plus-user payment reference may collide. | Disable live collection by default; provider-side status/amount/currency/reference/merchant verification, atomic idempotent settlement + regression tests. |
| **Critical** | `services/views.py` service action handles `unsuspend` without the staff-role restriction applied to suspend/terminate and mutates Service DB status without independent host confirmation. | Server-owned authorization/state machine, make privileged actions staff/system only, worker/provider confirmation; negative client A/B tests. |
| **High** | `provisioning/views.py` `create` references `Provider` without importing the model. `process_next` handles host operations synchronously in HTTP request with no task lease; worker ID comes from the caller. | Import/model fix, reject host-side operations until worker-ready, acquire atomic DB lease and idempotent provider task processing; failed/successful result tests. |
| **High** | Console uses Next.js 14.2.x / React 18. Next.js security release May 2026 states all Next.js 14 versions affected; patched major needed. | Separate tested upgrade to supported patched major; compatibility, auth middleware, responsive UI and lockfile regression + dependency advisories. |
| **High** | Session handling uses browser sessionStorage JWT in addition to HttpOnly cookie; `frontend/src/app/api/auth/session/route.ts` stores tokens submitted by caller without server-side token verification at that handler. | Threat model, authoritative host-only session, CSRF, rotation/revocation, login/logout/signed-out browser tests and admin MFA. |
| **High** | `python manage.py check --deploy --tag security --fail-level WARNING` fails security.W004/W008. | Verify TLS termination/proxy and HSTS policy, implement tested secure settings and rerun gate. |
| **High** | Neon Preview schema migration not confirmed complete, production DB intentionally absent. | Approve isolated migration plan, apply via restricted migration job/Codespace, verify migration ledger and persistent account across redeploy. |
| **High** | Public Cloud link `Get Started` in live browser resulted in Chrome error; current workflow marks live test continue-on-error so overall workflow can be success. | Establish real Console destination through visible click, change assertion/reporting to require success for release, verify mobile/desktop; do not use direct deep URL. |
| **Medium/high** | Hosting state and customer UI include stub operations (reboot/start/stop/password) returning success-like responses without provider execution; `Provider` adapters lack full contracts. | Never claim infrastructure task success without provider confirmation; simulator clearly marked as simulation and release-disabled. |
| **Medium/high** | Backend requirements list repeated, unpinned Python packages; not a reproducible production artifact. | Normalize requirements and lock/pin transitive dependencies, run pip-audit/SCA, SBOM and build twice in clean environments. |
| **Medium** | Public Cloud domain pricing still returns marketing fallback prices; registrar search now returns no fabricated availability. | Mark fallback as indicative, implement server-side registrar availability/pricing and checkout verification before selling. |
| **Medium** | OPanel repo reported public and empty when last checked. | Make private, separate identity/service-scoped API design, implement only after Console authority is audited. |
| **Process** | `.github/workflows/deploy.yml` still offers a manual SSH deploy into retired VPS, although auto-push removed. | Archive/remove during eventual cleanup; no secrets/SSH workflow for Vercel release. |

## Critical distinctions
1. **"Main" is Vercel Production code by default.** GitHub merge normally causes Vercel auto-production deployment. Production data/configuration must exist before accepting that outcome.
2. **A Vercel READY build and a Django /health JSON response are not readiness**: neither checks tables, real login, session origin, invoice settlement, or worker operations.
3. Do not treat the 152 DRF Spectacular API-schema warnings seen with unfiltered Django --deploy check as 152 confirmed vulnerabilities. The isolated security tag check reports two genuine configuration warnings. The earlier weak-secret warning came from a deliberately short CI-only fixture and was removed from the focused gate.
4. For Vercel Hobby, consult official non-commercial restriction; any actual company revenue/pilot rollout may require Pro or a compliant hosting alternative.
5. Django migrations should be a controlled one-shot release step; do not execute at every serverless request/build. A `workflow_dispatch` file must exist on GitHub's default branch before the UI can manually dispatch it, but the limited workflow can be independently reviewed/merged without promoting the whole app.

## Safe release approach — avoid keeping all progress blocked
**Gate 0: cleanup and isolation.** Make an independent minimal PR for Vercel-compatible harmless settings, logging protections, URL policy and release checks; no speculative settlement or provisioning logic. Close/split the large PR if needed, preserving commits.

**Gate 1: security and runtime.** Security audit of auth/tenant/financial/hosting operations; repair code with negative tests; patched Next.js supported major; pinned dependencies; Django production checks green.

**Gate 2: real preview acceptance.** Independent Neon Preview schema migration with review/rollback evidence; accessible Console+API preview with Vercel authentication; browser-only `cloud.octalve.com -> Get Started -> register -> login -> dashboard -> visible menus`, not direct deep links or direct test API calls. Payments and real provisioning excluded or explicitly disabled until qualified.

**Gate 3: production-like pilot.** Separate Production/pilot Neon database, non-production payment keys or disabled payment routes, unique production app secrets, exact origin rules, backups, monitoring, alerts, email verification and admin MFA. If Vercel Hobby terms do not permit company use, select a compliant host and keep code portable. Test with authorized pilot identities.

**Gate 4: controlled merge/promotion.** GitHub protected main; required CI checks and PR review; Vercel Git-integrated automatic Preview builds and Production builds; qualified main promotions only after change approval. Prefer configuration that separates production *build* from *domain promotion* when supported. Retain a deliberate schema migration approval step. Never require the owner to manually trigger ordinary builds.

## Research / normative sources
- Vercel Git integration: https://vercel.com/docs/git
- Vercel Production/Preview separation: https://vercel.com/docs/deployments/environments
- Vercel Hobby policy: https://vercel.com/docs/limits/fair-use-guidelines
- GitHub protected branches: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- GitHub manual workflow requirement: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
- Django deployment checklist: https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/
- Django `makemigrations --check`: https://docs.djangoproject.com/en/6.0/ref/django-admin/
- Django proxy/HTTPS security: https://docs.djangoproject.com/en/6.0/topics/security/
- Next.js May 2026 security release: https://vercel.com/changelog/next-js-may-2026-security-release
- Neon data branching: https://neon.com/docs/get-started-with-neon/workflow-primer
- OWASP ASVS 5: https://asvs.owasp.org/
