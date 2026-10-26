# Octalve Cloud — Exact release audit, recovery batch and production gates
**Audited:** Monday, 26 October 2026, Africa/Lagos
**Primary Console PR:** https://github.com/octalve-core/octalve-console/pull/14 (draft, stacked on #13)
**Independent OPanel PR:** https://github.com/octalve-core/octalve-opanel/pull/1 (draft)
**Release authority:** Review-only. No Production merge, migration, actual gateway charge, remote account creation or client hosting write in this batch.

## A. Where we started, and what already existed

- Octalve Console is the WHMCS-like **commercial system**. It owns customer identity, billing, published plans/markups, payment gateway configuration, versioned checkout, invoices, orders, paid settlement, vendor/provisioning authority and provider-confirmed OPanel grants.
- Octalve OPanel is the **independent hosting technical product**, NOT code hosted inside Console. It has an independent Next.js/TypeScript responsive frontend, Django backend, secure own cookie/session store and no second customer password; entry is by short-lived PKCE-backed Console authorization.
- On 23–24 October, the Production Console authentication baseline had browser-passed signup/login/logout, persistence, route protection and role denial. Production Neon was reported at 49 migrations/92 tables. This batch did not requery Production's migration ledger or modify it.
- Console PR #13 provides the approved supplier/retail published plan, package mapping and commercial pricing/checkout provenance. PR #14 is stacked on it and includes confidential owner-scoped readback, account binding, read-only overview, OPanel SSO, gateway verification, atomic settlement, durable hosting outbox, existing-account reconciliation and fixed checkout flow.
- OPanel PR #1 had new work on 26 October: native unprivileged account-worker prototype, management-operation boundary, current Console-contract CI and browser regressions. Native worker is not a remotely enrolled hosting node, not a substitute for real vendor availability and not a commercially live hosting-management backend.

## B. Audit results on current external infrastructure

- All three open draft PRs (Console #13, Console #14, OPanel #1) had green GitHub Actions at the initial 26 October audit. All remain **unmerged**.
- The Vercel team is on **Hobby**. Review deployments show old Console frontend READY commits, but they are NOT the current draft PR head. Some older API Preview deployments are ERROR.
- Inspected Vercel API Preview error on deployment `dpl_5xnCfJR2YfocbUQY2EMegKt11gaY`: `DJANGO_SETTINGS_FAILED` while trying to load `DJANGO_SECRET_KEY`. API environment variable names revealed branch-scoped Preview entries for `review/cloud` and certain older review branches; none were scoped to `phase/cloud-paid-provisioning-opanel-foundation`. The missing secret is therefore an actual Preview configuration blocker, in addition to prior rate-limit failures. No secret values were read or copied.
- Both `backend/vercel.json` and `frontend/vercel.json` on the Console branch ALREADY disable automatic Preview builds for `review/cloud` and wildcard branches while allowing `main`. No changes to Vercel projects, secret targets or deploys were made in this batch.
- Provider/gateway test secrets and an authorized hosting server were not available to this execution. Do **not** copy Production Neon/gateway/provider credentials to Preview or broaden an existing branch's secret scope just to make a build succeed. Provider hostname allowlisting does not replace egress/firewall/DNS-rebinding controls.

## C. Changes made during 26 October batch

### C1. Transactional single-create attempt fence
- New `provisioning/create_attempt.py` introduces **one durable local reservation per fully paid and uniquely queued hosting task**, behind `CLOUD_CREATE_ATTEMPT_RESERVATION_ENABLED=false` and `CLOUD_PROVISIONING_WORKER_ENABLED=false`.
- The code locks task/service/provider records and re-checks genuine payment authority with `plan_account_creation`. It records one random attempt ID, immutable account/provider/plan fingerprint, `reserved_no_network` state, initial attempt count, and redacted `ProvisioningLog`. It moves the queued task to `pending_confirmation`.
- Duplicate reservation requests return the SAME attempt identity only if current account and financial coordinates remain valid; tampered, failed or completed tasks cannot receive a new attempt. This reservation **does not claim a network POST happened**.
- `provisioning/reconcile.py` can now reconcile such a reserved pending task using the existing exact verified DirectAdmin/WHM account read-back. No provider API evidence means **no service activation and no OPanel proof**. Existing queued/manual account reconciliation remains available behind previous default-off controls.
- `ProvisioningTask.mark_failed()` sends unknown-result host mutations to `needs_review` rather than auto-retry; the admin retry HTTP action now accepts read-only sync actions only. `mark_completed()` continues to forbid mutation as success authority.
- Private `python manage.py cloud_paid_funnel --task-id <ID> --reserve-create [--apply]`: without apply, validate only; with apply, persist exactly one no-network attempt. It is NOT the account-creation command and does NOT mean the vendor received anything.
- Pure `provisioning/vendor_create_contract.py` formats **no-network** vendor payloads for official DA `CMD_API_ACCOUNT_USER` POST and WHM API1 `createacct` GET, using the already-approved eight-character username and reseller/package/domain from the paid order. WHM suppresses automatic password display; DA password is ephemeral and withheld from representations/logs. No provider API key is carried in this contract; no WAN mutation executor is wired or approved.
- Critical explicit remainder: actual vendor dispatch, exactly-one outbound write, node/credential enrollment, durable sent/unknown transitions, egress/firewall, provider-specific success/absence semantics and recovery under timeout still require authorized server acceptance.

### C2. Authentic test gateway acceptance without money
- Existing Paystack and Flutterwave readback was **live-key-only**, which prevented a legitimate test-key payment-verification rehearsal.
- New `payments/sandbox.py` allows test credentials only when BOTH `CLOUD_GATEWAY_SANDBOX_READBACK_ENABLED=true` and `CLOUD_ISOLATED_REVIEW_CONFIRMED=true`, plus Preview runtime or DEBUG (never `VERCEL_ENV=production`). Test-mode gateway configuration and matching test-key prefix are required.
- `payments/readback.py` allows Paystack `domain=test` ONLY in this isolated lane and still requires matching reference, currency, amount, complete intent, verified provider success, fixed TLS endpoint, bounded response and correct key mode.
- `payments/hosted_checkout.py` can create a sandbox link only behind its existing separate default-off controls and sandbox flags. `payments/webhook_inbox.py` can similarly parse properly signed sandbox gateway notifications but NEVER settle payment.
- **Hard money boundary retained**: `settle_verified_intent` categorically rejects `gateway.test_mode=True`, and the provisioning policy rejects test-mode payment truth. A successful sandbox transaction can be observed in Preview, but never becomes a paid Production invoice, activated service or OPanel entitlement.
- No actual gateway APIs were called or cards charged in this batch. All new tests use synthetic responses and test credentials.

### C3. CI and regression
- Added synthetic test cases to the existing C1 Django run: single attempt, re-reservation, provider-readback of reserved account, timeout/manual review, vendor payload schema/secret redaction, sandbox readback, refusal in Production runtime and refusal to settle/fulfill test payments.
- No new DB migration is required for these additions: attempt marker uses existing ProvisioningTask status/metadata/log columns, and gateway sandbox uses existing PaymentGateway.test_mode.
- GitHub Actions checks are not live provider/browser qualification. Keep all new/old flags off in Production.

## D. Default-off controls (do not copy secrets into Git or chat)

```env
# Only use sandbox in a verified isolated Preview/test database, never Production
CLOUD_GATEWAY_SANDBOX_READBACK_ENABLED=false
CLOUD_ISOLATED_REVIEW_CONFIRMED=false
# No outbound hosting account creation
CLOUD_CREATE_ATTEMPT_RESERVATION_ENABLED=false
CLOUD_PROVISIONING_WORKER_ENABLED=false
OPANEL_READBACK_ENABLED=false
OPANEL_ISSUER_ENABLED=false
# Existing real-money endpoints/settlement remain disabled
CLOUD_HOSTED_CHECKOUT_ENABLED=false
CLOUD_HOSTED_CHECKOUT_HTTP_ENABLED=false
CLOUD_PAYMENT_STATUS_HTTP_ENABLED=false
CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED=false
CLOUD_GATEWAY_READBACK_ENABLED=false
CLOUD_SETTLEMENT_COMMIT_ENABLED=false
CLOUD_FULFILLMENT_STAGING_ENABLED=false
```

Use **independently generated** Review-only Django secret, shared BFF session secret, encrypted isolated Review DB URL and Console/OPanel client credentials. No Production values, and no secret entry into source. Configure dedicated Vercel Preview *branch scope* only after a separate Review database and correct HTTPS origins exist.

## E. Exact remaining release qualification (in order)

1. **Isolated Preview identity:** pin exact PR head and review-only database for API, Console frontend and OPanel backend/frontend. Deploy the two independent products under approved HTTPS Review URLs; correct branch-scoped Django settings including SECRET_KEY and BFF secret. Verify API health, migration ledger, cookies, CSRF/CORS, login and OPanel callback. Vercel quota must allow a small explicit number of builds; no repeated per-commit deployments.
2. **Real no-money gateway sandbox:** install dedicated Paystack/Flutterwave TEST keys only in isolated Review, use provider-issued test payment details, verify initialisation/webhook signature/verify-by-reference and non-settlement of sandbox results. Capture provider-response versions. Never enable Production gateway or accept live user funds for qualification.
3. **Authorized vendor server:** obtain a disposable WHM or DirectAdmin instance with isolated reseller, package, DNS/domain, account token and restricted network. Validate supported package/username/owner fields and known absent-account semantics before attempting any creation. Enforce DNS+egress restrictions, TLS and approved credential storage; do not place vendor admin keys in browser code.
4. **Exactly-once remote creation:** implement the outbound worker with an explicit durable dispatch transition, one stable task ID/account, preflight account absence, no blind POST retry, unknown-result status, exact provider GET reconciliation, error handling/compensation and manual intervention. Qualify provider behavior with genuine test-account creation and negative race/ownership tests, then only enable scoped reviewed worker in isolated Preview.
5. **End-to-end browser acceptance:** published catalog offer → checkout → test payment (no money) → independently reviewed payment authority → real provider account verification → OPanel PKCE callback/session → customer access/revocation/logout. These require coherent isolated test semantics and cannot equate test provider data with real production settlement.
6. **Native OPanel if used:** separately qualify node enrollment, mutual TLS, account-specific OS UID/namespace, ephemeral keys, hardened replay DB, quotas, audit and explicit management grants. Its file-manager prototype is not production hosting yet.
7. **Release:** qualify Console catalog PR #13, then stacked PR #14, then independent OPanel PR #1 against actual required gates; only after owner authorizes, merge in dependency order, apply only new migrations on Production after preflight, verify both Production endpoints, and enable high-risk flags individually with rollback and monitoring. Do not merge drafts simply to bypass Preview quota.

## F. Sources and truth boundary
- Vendor wire descriptions use DirectAdmin official https://docs.directadmin.com/developer/api/legacy-api.html and WHM API1 https://api.docs.cpanel.net/specifications/whm.openapi/account-creation .
- Payment contracts use Paystack official https://paystack.com/docs/api/transaction/ and Flutterwave official https://developer.flutterwave.com/docs/webhooks .
- Current GitHub Action tests are synthetic, except OPanel's local filesystem/browser tests and in-process cross-repository contract. External server/browser payment qualification is **not** claimed.
