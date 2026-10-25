# Octalve Cloud — One-batch paid hosting authority / OPanel acceptance

**25 October 2026. Status: Review-only code, synthetic end-to-end acceptance. No live payment, hosting creation, Vercel release, or Production migration.**

## Exact product separation

- **Octalve Console** (`octalve-core/octalve-console`) is the commercial and customer-identity authority. It publishes an approved supplier-priced/retail offer, accepts a versioned checkout, records invoices and gateway-confirmed settlement, stages uniquely keyed hosting work, verifies the actual provider account and authorizes OPanel access.
- **Octalve OPanel** (`octalve-core/octalve-opanel`) is a separate Next.js/TypeScript + Django technical product with its own database/session/CI. It trusts ONLY Console's fresh entitled service identity and private audience-bound SSO, not payment redirects or browser service IDs. Technical write tools remain disabled pending real provider tests.

## Implemented in this consolidated Console Review branch

**A. Published hosting package → order and unpaid invoice** (already implemented, preserved):
- Admin-approved immutable `PublishedCatalogOffer` with supplier ID/package/retail revision; client checkout rechecks revision, price, cycle, supplier status, currency and cost floor.
- Checkout UUID idempotency, order and invoice in one DB transaction. Customers cannot PATCH the paid/provisioned state.
- Real domain registration/VPS/DNS fulfillment intentionally not included in this shared-hosting slice.

**B. Independently verified gateway payment** (new code):
- `payments.readback.verify_gateway_intent`: server-side HTTPS GET only; Paystack `/transaction/verify/{reference}`, Flutterwave v3 `/transactions/verify_by_reference?tx_ref=...`.
- Requires a server-created, non-expired `PaymentIntent`, identical reference, active non-test configured gateway/secret, exact expected amount/currency and independently successful provider status. Paystack amounts use minor units; Flutterwave amounts use major units; JSON float decoding uses Decimal.
- Never trusts a redirect, signed webhook by itself, customer-supplied amount, or provider's outer HTTP success status. Rejects incorrect amount (both over/under), gateway status, expired intent, currency, wrong reference, malformed data, non-TLS, redirects and oversize response.
- Fixed vendor endpoints, 8-second timeout, explicit TLS verification, no redirects, 64 KiB stream read cap, server-only credentials.
- **No gateway initialization or customer payment API is enabled:** `/api/payments/initialize/`, `/verify/` and `/webhook/` still return 503. These must remain blocked pending signed webhook settlement and hosted checkout acceptance.

**C. Atomic payment settlement** (new, disabled by default):
- `payments.settlement.settle_verified_intent` verifies provider response first, then locks PaymentIntent, Invoice and Order, checks full ownership/total/currency/amount, provider remote transaction identity and uniqueness.
- Creates exactly one successful Transaction with `provider_api_verified` provenance; moves Invoice/Order/Intent to paid/completed inside one transaction; replays return the existing completed payment without another provider call or a second financial write.
- Never calls a hosting provider. Signed webhook verification remains a separate future integration; `webhook_verified=False` correctly distinguishes API readback from signed webhooks. `provisioning.authority` checks the corresponding evidence.
- The legacy wallet invoice shortcut was disabled: it formerly debited a wallet before marking an invoice paid and could record a zero payment amount. No wallet payment is currently accepted through that endpoint.

**D. Durable hosting outbox** (new, disabled by default):
- `provisioning.fulfillment.stage_paid_order` requires a paid matching invoice/order with EXACTLY one independently verified successful financial transaction, stable order-item provider/package/retail snapshot, active healthy approved DirectAdmin/WHM supplier and exactly one hosting unit.
- Atomic order lock + stable `ProvisioningTask.lock_key=paid-hosting:order-item:<id>:v1` creates ONE `Service.status=pending` and ONE `ProvisioningTask.status=queued` per paid item. Future retries reuse both records; mismatched/colliding existing records reject.
- Account name planned deterministically from order-item ID; no browser-supplied account/host/API credentials enter the queue. Never activates a service from a queue receipt.
- Mark-completed mutations fail closed unless the separately audited reconciliation method has independently confirmed the provider account.

**E. Provider reconciliation → Console proof → independent OPanel** (new, disabled by default):
- `provisioning.reconcile.reconcile_verified_hosting(task_id, apply=False)` checks a known paid pending task and a real vendor account via bounded *read-only* DirectAdmin or WHM API using stored, server-side provider keys and exact username/domain/reseller owner.
- Default is read-only dry-run. `apply=True` requires fresh provider evidence, then locks and rechecks task/payment/order/item/service/provider configuration. Only after positive remote account proof does it mark Service.active, start purchased billing period from confirmation, save a private provider-account fingerprint/15-minute freshness proof, complete the task, and mark Order provisioned once all ordered items are independently confirmed.
- The one-time Console → OPanel PKCE launch and OPanel own Secure/HttpOnly session are tested against a synthetic activated hosting service.
- **This is an existing-account reconcile flow, not remote CREATE:** no WHM `createacct` / DirectAdmin `CMD_API_ACCOUNT_USER` POST/command is issued. Genuine account creation, deduplicating uncertain remote POSTs, compensation, retries/leases, failure notifications and recurring read-back remain future release gates.

## Operator-only isolated Review commands (no browser API)

All gates are **OFF** by default in `backend/octalve_backend/settings.py`:

```text
CLOUD_GATEWAY_READBACK_ENABLED=false
CLOUD_SETTLEMENT_COMMIT_ENABLED=false
CLOUD_FULFILLMENT_STAGING_ENABLED=false
CLOUD_PROVISIONING_WORKER_ENABLED=false
OPANEL_READBACK_ENABLED=false
OPANEL_ISSUER_ENABLED=false
```

Never enable these in Production as a shortcut. Use an isolated Review database and approved, restricted network/vendor credentials. The database IDs below must be genuine Review records; no user-supplied hostname/secret is accepted by the command.

```bash
cd backend
# Read-only gateway status lookup. No financial DB writes.
python manage.py cloud_paid_funnel --intent-id 123

# Commit a provider-verified settlement (DANGEROUS outside isolated Review).
python manage.py cloud_paid_funnel --intent-id 123 --apply

# Dry-run stage: nested transaction is rolled back.
python manage.py cloud_paid_funnel --order-id 456

# Persist one pending service + unique task per paid hosting item.
python manage.py cloud_paid_funnel --order-id 456 --apply

# Read-only check of existing account on the approved vendor.
python manage.py cloud_paid_funnel --task-id 789

# Re-read live account and atomically issue hosting proof / activate.
python manage.py cloud_paid_funnel --task-id 789 --apply
```

No supplied example ID must be treated as an existing legitimate account or payment; replace them only with actual isolated Review records.

## CI and safety invariants

- `payments.test_readback`: gateway references, Paystack cents, Flutterwave, exact money, wrong customer/currency/amount, disabled flags, redirect and excessive size.
- `provisioning.test_paid_funnel`: synthetic order/invoice, API-proven payment, replay/idempotency, unique outbox, no false service activation, verified provider account + OPanel SSO issuance/replay, wrong reseller denial.
- Existing `opanel_bridge.test_readback` and `opanel_bridge.tests` cover expiry, cross-client, replay, provider config rotation, suspended account and role denial.
- No new migrations: the prior proposed Console Review schema remains 51 migrations/96 tables and Production Neon baseline remains 49/92. No Production migration was executed.
- The isolated CI Postgres workflow is not a live hosted provider acceptance or a Review deployment.

## Release blockers and mandatory acceptance

1. Validate real published supplier package/retail price acceptance with a dedicated authorized DirectAdmin/WHM test server and reseller account. Scope credentials to test account only. Exact owner/username/domain checks.
2. Implement and qualify hosted gateway checkout/initialization plus signed webhook/independent API reconciliation, refunds and overpayments; test without collecting real customer money. Current customer payment endpoints stay 503.
3. Complete durable provider CREATE worker: fixed vetted package, idempotent remote identity, pre-create GET, uncertain-POST recovery by GET (never blind retry), leases/fencing, permanent failure/manual exception queue, and protection against resource and reseller cross-tenant mismatch.
4. Audit DNS rebinding and network-layer egress restrictions. Host allowlist alone is not enough; do not enable real outgoing commands otherwise.
5. Build two isolated Review deployments with exact commit and private test databases; resolve Vercel build-rate-limit without unnecessary deploy attempts.
6. Browser acceptance: published offer → order → invoice → test gateway payment (no money) → provider account create/reconcile → evidence → OPanel SSO → logout → suspension/expiry/revocation/wrong user/CSRF/race handling. Test billing term start from provider confirmation.
7. Qualify Console PR #13 before #14; OPanel PR #1 independent. Merge and deploy in dependency order only after all mandatory gates pass and owner approves Production release.

**Sources:** Paystack official https://paystack.com/docs/api/transaction/ ; Flutterwave v3 https://developer.flutterwave.com/reference/verify-transaction-with-tx_ref ; DirectAdmin https://docs.directadmin.com/developer/api/ ; WHM https://api.docs.cpanel.net/.

## Next consolidated increment — hosted checkout and signed notifications (25 October)

The previous release remains Review-only and all commercial live execution is still disabled. This increment **does not require any schema migration** and does not change the independently deployed OPanel repository.

### A. Two-stage public hosted checkout, blocked until separate acceptance
- New `backend/payments/hosted_checkout.py` implements server-generated, single-use merchant reference and PaymentIntent reservation for an exact owned NGN invoice, followed by fixed Paystack `POST https://api.paystack.co/transaction/initialize` or Flutterwave v3 `POST https://api.flutterwave.com/v3/payments`.
- Paystack sends integer kobo; Flutterwave sends exact decimal NGN major units. Neither caller-supplied amount nor browser gateway secrets are accepted. Both use TLS, no redirects, limited 8s timeout and 64KiB response.
- Callback/return address comes **only** from `CLOUD_PAYMENT_RETURN_URL`, a preapproved HTTPS value pointing to the independently-authored Console page `/client/payments/return/`. That page never reads browser claims as paid truth; it directs users to their orders without authorizing fulfillment. A hosted link is accepted only on exact `checkout.paystack.com` or `checkout.flutterwave.com` with the expected provider route, no credentials, ports, fragments or query redirects.
- Reservation happens BEFORE network I/O. A confirmed attempt reuses its originally validated hosted URL. On timeouts or ambiguous provider result, the attempt remains `processing`, `checkout_state=reserved`; NO automatic re-POST, switch of gateway, or new merchant reference. Operator reconciliation is mandatory.
- `/api/payments/initialize/` is now implemented behind **two** default-off flags and strictly enforces authenticated invoice owner and exactly `{invoice_id,gateway}`. It returns only the hosted URL, server reference, expiration and invoice ID. `/api/payments/verify/` is a separately gated *read-only owner-scoped DB status* endpoint: it ignores browser status/transaction query parameters and NEVER marks payment successful.
- These endpoints are not activated for real customers; no hosted payment link has been opened or charged.

### B. Signature-verified, redacted webhook inbox
- `backend/payments/webhook_inbox.py` verifies Paystack `X-Paystack-Signature` HMAC-SHA512 using the gateway secret, or Flutterwave v3 `verif-hash` using a separately configured webhook secret. JSON parsing happens only after signature verification, with a 64KiB body cap.
- `/api/payments/webhook/<gateway>/` is disabled by default. When explicitly enabled, it accepts only supported successful charge-event types and stores a minimal deterministic deduplicated `WebhookEvent`: intent ID, merchant reference and gateway transaction ID. No card, customer email, authorization code, complete provider payload or secret headers are stored.
- Webhook ingestion NEVER marks invoice/order paid, never creates a financial `Transaction`, never stages hosting and never enables OPanel. A separate independent gateway API verification and atomic settlement are still mandatory.
- Unknown gateway references or non-charge events do not create customer entitlement. Signed webhook retries are idempotent. No customer browser initiates settlement via redirect.

### C. Provider-create contract (deliberately no remote write)
- Provider documentation establishes DirectAdmin legacy username maximum of **8 alphanumeric characters**. The prior `oc<ten-digit-id>` username proposal was incompatible. `planned_hosting_username()` now encodes an order-item primary key into `oc` plus six base36 digits: collision-free across IDs 1 through `36**6-1` and exactly eight characters, valid for DA and WHM.
- `backend/provisioning/account_creation_plan.py` provides an immutable financial- and seller-verified username/domain/package/owner/email preflight for a uniquely staged, fully settled queued hosting task. The operator cannot request arbitrary usernames or provider packages. No password or vendor secrets are returned.
- `execute_account_creation()` still intentionally **rejects all writes**. A proper remote-create worker requires approved dedicated provider credentials, tested live/vendor call syntax, a durable unknown-result marker, account-absence proof, never-blind-retry rules, and account-scoped TLS/egress controls. These cannot be inferred from simulated tests.
- The existing provider reconciliation can attach and activate a *truly verified existing* hosting account using independent vendor readback, but it will not create an account.

### Configuration — all disabled by default

```env
CLOUD_HOSTED_CHECKOUT_ENABLED=false
CLOUD_HOSTED_CHECKOUT_HTTP_ENABLED=false
CLOUD_PAYMENT_STATUS_HTTP_ENABLED=false
CLOUD_SIGNED_WEBHOOK_INGEST_ENABLED=false
CLOUD_PAYMENT_RETURN_URL=
CLOUD_GATEWAY_READBACK_ENABLED=false
CLOUD_SETTLEMENT_COMMIT_ENABLED=false
CLOUD_FULFILLMENT_STAGING_ENABLED=false
CLOUD_PROVISIONING_WORKER_ENABLED=false
OPANEL_READBACK_ENABLED=false
OPANEL_ISSUER_ENABLED=false
```

**Qualification conditions:** two feature flags required for browser checkout, authenticated owner-scoped invoice, cryptographically sound transaction signature, exact reference/amount/currency verification by gateway API, and provider readback before service activation. Actual live checkout execution and onboarding are NOT available while disabled.

### Verification

- `payments.test_checkout_webhooks`: test provider initialization URLs, exact amounts and owned invoices, repeated checkout, ambiguous POST recovery, malicious URLs, forged browser amounts, signed webhook dedup/redaction, unsigned-event denial, absence of financial/provisioning writes and owner-scoped payment-status-only access.
- `provisioning.test_paid_funnel`: provider account username length, base36 uniqueness, settled-only creation preflight, all remote create attempts rejected.
- Existing `payments.test_readback`, `provisioning.test_paid_funnel`, `opanel_bridge.tests` continue to assert independent payment evidence, atomic settle and verified existing account SSO.
- C1 CI and disposable PostgreSQL workflows provide isolated synthetic evidence. Neither is a live gateway transaction, production feature enablement, provider create acceptance nor browser E2E.

Official references: https://paystack.com/docs/api/transaction/ , https://paystack.com/docs/payments/webhooks/ , https://developer.flutterwave.com/reference/checkout , https://developer.flutterwave.com/docs/webhooks , https://docs.directadmin.com/developer/api/legacy-api.html , https://api.docs.cpanel.net/specifications/whm.openapi/account-creation .
