# OCTALVE CLOUD — REVIEW TO PRODUCTION OPERATIONS RUNBOOK
**Date:** 26 October 2026 | **Status:** PREPARATION, not authorization to deploy
**Parent:** [Master plan](CLOUD_MASTER_EXECUTION_PLAN_2026-10-26.md) · [Matrix](CLOUD_MASTER_ACCEPTANCE_MATRIX_2026-10-26.md)
**Policy:** No Production database changes, merge to `main`, customer charges, vendor server writes, or irreversible DNS/registrar changes unless the specifically named release gates, environment owner and current commit are qualified.

## 1. Immediate sequence for the next executor

1. Re-read the master plan/matrix/current PR heads and inspect the exact code. Do **not** ask for reapproval of already-approved development scope. Do not invent access to missing vendor credentials.
2. Consolidate Batch 0 and the safe code parts of Batches 1–3 on **existing branches**. Resist trivial PR proliferation, unnecessary deploys and major UI redesigns.
3. Run unit/security/contract/disposable PostgreSQL CI for both repos, compare artifacts and record exact SHAs.
4. Fix actual failures before doing another deployment. Preview is manual and coordinated only after isolated DB/secrets/route preflight and available Hobby capacity.
5. Verify two independent products, vendor-account sandbox, payment sandbox and real site ownership in isolated Review. Keep unqualified feature switches OFF.
6. Only after all mandatory minimum launch gates have external evidence, request final owner release approval and execute the controlled release window. No silent merge.
7. Deliver one consolidated report with status, evidence, blockers, exact test results and next action.

## 2. Branch graph and reproducibility

Console:
```text
main (Production)
  \___ PR #13 phase/cloud-provider-authority-preflight
           \___ PR #14 phase/cloud-paid-provisioning-opanel-foundation
```
OPanel: `main` (independent Production) ← PR #1 `docs/independent-foundation-design`.

**Dependency:** Console PR#14 includes PR#13 commits until #13 is merged. At the release window, validate #13 → release, qualify PR#14 again after retargeting to `main` (verify resulting diff and SHA), and independently qualify OPanel against EXACT finalized Console issuer SHA. Do not assume prior pinned contract CI (Console `a594d15...`) covers latest PR#14.

**Operational warning:** existing Console frontend/backend `vercel.json` has `git.deploymentEnabled.main=true`. A merge to `main` MAY automatically build/assign Production; coordinate Git integration production alias/staging settings before the merge. Do not casually merge #13 just because CI passed. For controlled rollout, protect Production branch and disable automatic assignment, then use a tested staged Production build and explicit promotion, or use a verified alternative project-level release gate.

### Safe local read-only preflight commands
```powershell
# From your local Windows checkout for each repository; NO secrets in output.
git fetch --all --prune
git status --short
git rev-parse HEAD
git log -1 --format="%H %cI %s"
git branch --show-current
# Inspect existing PR and compare against origin/main before any merger.
git diff --stat origin/main...HEAD
```

Never run `git push --force` on the existing Review branches, delete qualified work or script an automatic merge in the absence of external acceptance.

## 3. Isolated Review environment inventory (Batch 0)

### Console Backend
- Separate Review database identity + retained backup, not Production Neon. Verify source and schema ledger on a **read-only identity check**.
- Django secret and BFF/session secrets generated separately for Review, stored in scoped Vercel/env-secret store; not echoed to stdout, Git logs or chat.
- Review `ALLOWED_HOSTS`, CSRF trusted origins, secure cookies, TLS termination, proxy header trust, Console frontend/API URLs.
- Observe old API Preview blocker `DJANGO_SETTINGS_FAILED: DJANGO_SECRET_KEY` on phase branch. Configure *only* an approved dedicated Review branch/scope. Do not copy Production values.
- Prevent Preview from accidentally using Production PaymentGateway/provider records or mail sender; server secret alone is not sufficient isolation.

### OPanel Frontend/Backend
- Completely independent Review database, `DJANGO_SECRET_KEY`, `DATABASE_URL`, callback/public URLs and protected `OPANEL_CLIENT_SECRET`. The secret is shared with Console's *confidential OPanel client integration only*, not with Console's Django root/session secret.
- Public Next.js origin and fixed HTTPS independent Django upstream, account-scoped session/CSRF cookie, exact callback. Configure private origin/build variables in their expected project and stage.
- Recheck same-origin rewrites and CDN behavior for cookie, `Set-Cookie`, `Origin`, CSRF headers and 302. Failed SSO under an old deployed frontend is not proof current code is broken.
- OPanel native worker is **not deployed or enrolled** in the general Review infrastructure until account-scoped OS isolation, node authentication and audit are qualified.

### Provider and gateway
- Dedicated approved external DirectAdmin/WHM disposable server with **restricted reseller account**, assigned plan/package, domain that the operator owns, known username, egress allowlist/IP verification and TLS.
- Separate TEST Paystack/Flutterwave API keys and webhook secrets. Do not assign live credentials to sandbox, expose keys to a frontend, or enable financial settlement for sandbox transactions.
- Mail TEST delivery identity (verified domain), bounce handling, suppression and email preview so no real clients receive simulated confirmation.
- Domain registrar sandbox, if available, is independent of paid hosting acceptance.

### Safe Django preflight (only after confirming you are using isolated Review DB)
```powershell
# PowerShell from Console backend directory with REVIEW-ONLY environment
python manage.py check
python manage.py check --deploy
python manage.py showmigrations
python manage.py migrate --plan
# Unit tests may CREATE/MODIFY database tables; NEVER point them at Production.
python manage.py test payments.test_readback payments.test_checkout_webhooks provisioning.test_paid_funnel opanel_bridge.tests
```
The tests above are selective examples. **Required release gate is the repository's full green GitHub Actions suite**, disposable PostgreSQL schema suite and the OPanel independent frontend/SSO/contract suites, with exact candidate SHA recorded. `check --deploy` is a diagnostic and can legitimately flag safe Review settings.

**Migration truth:** old reports say Production had 49 migrations/92 tables and Review proposed 51/96. They are not fresh counts. Record the exact database endpoint identity, migration ledger, planned SQL/operations, current backup ID and restore check before any migration. Never automatically replay all migrations because an old report has different counts.

## 4. Controlled acceptance passes (Batches 1–4)

**Account creation gate:** One audited paid/synthetic fixture → unique queued task → single persistent reserve → vendor existence check → one authenticated create call on approved test supplier → exact read-back matching account/domain/reseller/package/status → scoped service activation → short-lived OPanel proof. If HTTP create gives timeout, mark unknown and reconcile by GET. Never blindly POST or GET `createacct` again (WHM API1 GET is mutating).

**Gateway gate:** One isolated merchant test payment using approved test keys, signed event plus independent verified reference/amount/currency and vendor status. Replay must be idempotent. A test gateway payment must **not** create live financial truth. Browser `return?status=success` must not settle. Normal live-money flow requires its own separately approved merchant acceptance, reconciliation/refunds/overpayment and Production thresholds.

**OPanel gate:** Console PKCE authorize → OPanel confidential exchange → own cookie → overview → server-only operation rechecking exact service scope and capability on every action; deny another customer, suspended, expired, wrong reseller, rotated provider config, replayed code and Console outage. No unrestricted admin provider API accessible from OPanel browser.

**Website-live gate:** Customer-owned disposable domain/subdomain → correct authoritative DNS/target server → controlled upload of static site or qualified WordPress install → HTTPS certificate valid → expected unique test content responds publicly → operational logs and revocation verified. Do not call a site live because a default provider page responds.

**Registrar domain gate:** Vendor API authoritative availability and status → immutable approved retail markup/discount/renewal cost → real registrar-side domain transaction test → verified nameserver/expiry → customer domain notification. Domain sales remain disabled while this is unavailable.

**Notifications gate:** Only event after committed authority state; outbox with idempotency key, retry and bounce handling. Test subject and message ID, sender domain SPF/DKIM/DMARC, no password tokens/WHM admin credentials; hosting user technical protocol credentials are separately securely resettable.

**Security/chaos gate:** no operations with mismatched tenant or replay; transient provider timeout, mismatched or duplicated account, webhook replay, DNS failure, SSL failure, unsupported WordPress runtime, quota overflow, account suspension, expiration, remote create unknown state, CSRF/cookie/domain mutation, and restore from checkpoint.

## 5. Protected release window — no skipped gates

### Before any merge or deploy
- Owner accepts release candidate scope: **shared hosting only** with existing owned domain, or wider domain sale only when D-01–D-06 PASS.
- Recheck latest PR heads, no unexpected changes, branch protection, security audits, Vercel team/project, GitHub statuses, CI exact run IDs, code-owner signoff, quota/cost.
- Enable a maintenance/release gate or staged Production deployment that prevents accidental auto-assignment from `main`. Record prior good deployment IDs.
- Freeze provider package ID/retail pricing revision, SSO callback, mailing domain, feature flags, DB target, migrations and key-rotation/rollback plan.
- Confirm durable worker runtime exists outside short-lived serverless request path if long-lived provider I/O/locks/polling are required; don't assume Vercel function is a process supervisor.

### Release in dependency order
1. Stage compatible, backward-safe Console schema on a verified Production database **only after backup, DB identity, plan, owner approval and test**. Apply *only* outstanding migrations; never blind rerun. If migration requires old+new code coexistence, use expand/contract rollout and delay breaking operations.
2. Merge approved Console PR#13 only when Production deployment is contained (or all required gates already pass). Retarget/review PR#14 into `main` and re-check diff, SHA and CI. Merge and stage qualified Console backend/frontend. Never enable gateway/provider-write flags merely because code was merged.
3. Update OPanel contract SHA to the final Console commit, pass 3 CI workflows and full browser E2E in Review, merge OPanel PR#1 to its independent `main` and stage OPanel Production components (independent DB migrations/secret).
4. Build a staged Production deployment with Production variables but **no custom domain assignment**. Validate API, Next.js pages, route protection, OPanel callback, DB migrations, cold start and error logs, no network mutations. Promotion of a Preview can cause a Production rebuild; don't mistake Preview binary for the final Production build.
5. Promote the **tested staged Production build** only after health + smoke pass. If multiple services cannot switch atomically, use backward-compatible API contracts, feature flags and dependency-ordered window.
6. Confirm owner-controlled live customer flow: first test merchant transaction with supervised/approved policy, exactly one approved hosting account, correct OPanel grant and disposable real HTTPS site. Only then expose hosting sales to the public.
7. Enable risky functionality by scope/merchant/provider/plan progressively; maintain a fast kill-switch: disable checkouts, settlement worker, provider writes, OPanel technical mutations independently. Domain registrar and native worker stay OFF unless their own gates pass.

### Suggested staged Vercel approach (operator reviewed only)
```text
- Inspect Vercel team/project/commit/alias/production branch.
- Confirm automatic Production domain assignment disabled or protected.
- Pull only authorized environment-specific variables into secure CI context.
- Build exact reviewed SHA as a Production build; stage without domain.
- Run HTTP/security/end-to-end tests on the staged deployment.
- Promote that staged Production build (no rebuild); verify aliases.
- Observe errors, sessions, payments and provider queues.
```
Reference: https://vercel.com/docs/deployments/promoting-a-deployment .
Do NOT execute `vercel --prod`, `vercel promote`, `git merge`, Production `migrate` or any real payment/provider operation as part of ordinary documentation creation.

## 6. Feature switch groups (all OFF until separately approved)

| Group | Relevant flags | Required approval |
|---|---|---|
| Gateway sandbox only | `CLOUD_GATEWAY_SANDBOX_READBACK_ENABLED`, `CLOUD_ISOLATED_REVIEW_CONFIRMED` | Isolated Preview identity + test keys |
| Hosted customer checkout | `CLOUD_HOSTED_CHECKOUT_ENABLED`, `CLOUD_HOSTED_CHECKOUT_HTTP_ENABLED`, `CLOUD_PAYMENT_STATUS_HTTP_ENABLED` | Merchant/callback/quote acceptance |
| Webhook/financial settlement | `CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED`, `CLOUD_GATEWAY_READBACK_ENABLED`, `CLOUD_SETTLEMENT_COMMIT_ENABLED` | Signature, exact provider verify, refunds/reconciliation and idempotency |
| Hosting work | `CLOUD_FULFILLMENT_STAGING_ENABLED`, `CLOUD_CREATE_ATTEMPT_RESERVATION_ENABLED`, `CLOUD_PROVISIONING_WORKER_ENABLED` | Vendor account, egress, outage/duplicate handling |
| Console OPanel issuer | `OPANEL_READBACK_ENABLED`, `OPANEL_ISSUER_ENABLED` | Exact provider proof, client secret and HTTPS SSO |
| OPanel read adapter | `OPANEL_VENDOR_READBACK_ENABLED` | Account-scoped token and safe provider readback |
| OPanel write capabilities | Currently NOT public/production-capable | New explicit op scopes + E2E + audit; no blanket switch |
| Domain registrar/native hosting | Not operational; do not invent flags | Independently qualified adapter and owner authorization |

Changes to flags are logged with operator/date, current sha, reason, expected effect and rollback instruction. Enabling one flag must never implicitly enable another.

## 7. Rollback and incident response

- **Payment issue:** immediately disable hosted checkout HTTP/settlement/webhook writer as appropriate; preserve idempotent transaction ledger for reconciliation; do not delete/overwrite invoices, refunds or webhook evidence to "undo" money.
- **Remote create issue:** stop worker/network mutation dispatch; preserve reservation/attempt/outcome; read-only provider reconciliation and manual escalation. Never resume automatic writes until conflicting accounts/provider state are accounted for.
- **Wrong-tenant access:** disable management scope and SSO issuer if necessary, revoke sessions/grants, rotate affected integration and provider keys through secret store, audit logs and notify as required.
- **DNS/SSL/site issue:** return to last known good application/release and correct authoritative DNS/cert; DNS rollback can take time and cannot be treated as instantaneous.
- **Application deploy failure:** promote/rollback to known-good deployment after compatibility check. Rolling code back may **not** roll schema/data back. Use forward-compatible migrations, restore checkpoint with operator supervision if necessary.
- **DB migration failure:** block further release, record ledger and verified backup, execute approved forward fix or recovery. Never automatically downgrade schema with existing payment/customer records.
- **Vercel quota:** stop deployment attempts, keep current Production, use CI unit tests/offline prebuilds and defer Preview until capacity; never bypass review by merging unqualified branch.

## 8. Go/no-go release checklist

```text
[ ] Exact reviewed Console and OPanel SHA + dependency pins
[ ] Production branch auto-assign behavior and release window approved
[ ] Isolated Review accounts/DB/HTTPS, all external gates signed PASS
[ ] Real existing-domain shared-hosting service active and exact reseller proof
[ ] Real audited, once-only vendor account creation tested
[ ] Signed webhook + independent provider payment verification; no duplicate invoice
[ ] Cross-tenant/timeout/PKCE/CSRF/revocation/renewal regression suite
[ ] Static or WordPress website actually responds with unique expected content + HTTPS
[ ] Hosting-ready/status/customer support emails deliver without credentials leakage
[ ] Domain registration disabled unless registrar suite separately PASS
[ ] Fresh Production DB identity, migration plan, backup/restore checkpoint
[ ] Production staging build tested, aliases gated, previous good deployment known
[ ] Monitoring, exception/reconciliation queue, support and kill-switch verified
[ ] Explicit owner go-live approval captured
```

**Release is BLOCKED when any required item remains unchecked.** Use the acceptance matrix for named evidence; do not close a release via generic "CI green" claims.