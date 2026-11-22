# Octalve Cloud — Commercial launch gate: Paystack vault and TLD rate cards
22 November 2026 | Source qualification, not unconditional Production activation.

## Confirmed Production facts
- DNS-01C already applied: 64 Django migrations, 117 public tables.
- One encrypted and saved integration, one verified vault authenticator.
- No Paystack PaymentGateway record, no TLD price cards, no published catalogue
  offer, no payment intents, and no webhook events when audited.
- Console and API are deployed and publicly responding, but endpoint liveness
  does not certify supplier execution, real payments or order fulfillment.

## Where vendor keys go
The Octalve Provider Vault is the intended interactive Super Admin credential
entry mechanism (not an environment variable with a browser-facing copy).
`/admin/integrations?provider=paystack` uses the existing secure side sheet.
- Super Admin must be active, email-verified, staff and superuser with the
  `admin` role. Password plus an independent, fresh six-digit vault TOTP are
  required for creating, rotating, revoking and verifying encrypted connections.
- The existing provider vault stores `IntegrationCredentialVersion.ciphertext`
  using versioned Fernet authenticated encryption, a separate active key ID,
  key-rotation support and signed append-only audit events.
- Required vault secrets and audit/step-up/backup key materials must be
  independently held and recovered (not in Git, DB, logs or browser storage).
  Do **not** set custody or release flags merely because the UI looks ready.
  Obtain an isolated restore receipt and successful existing vault readiness.
- On a trusted Vercel/API Production project configure:
  - `CLOUD_PROVIDER_CUSTODY_VERIFIED=true` **only with evidence**;
  - `CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED=true` **only with evidence**;
  - `CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=true` for credentials;
  - `CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED=true` only when enrollment needed;
  - `CLOUD_PROVIDER_ALLOWED_DRAFT_ADAPTERS=cloudflare-dns,paystack`
    or the existing approved list plus `,paystack`, preserving every existing
    provider that still needs secure credential rotation;
  - `CLOUD_PROVIDER_VAULT_KEY`, `CLOUD_PROVIDER_VAULT_KEY_ID`,
    `CLOUD_PROVIDER_AUDIT_KEY` and `CLOUD_PROVIDER_STEPUP_KEY`
    are *pre-existing* externally custodied secret settings and must remain
    separated. Never output their values to a chat or logs.
- The new Paystack schema accepts `sk_test_...` only when test mode selected,
  and `sk_live_...` only with live mode selected. Keys are kept encrypted,
  versioned and never returned to the browser.
- `Verify access` decrypts *only inside Django*, calls
  `GET https://api.paystack.co/balance` over TLS with no redirects or proxy
  and strict timeout/response-size limits, checks status and discards
  merchant balances. It creates a version-matched read-only audit receipt.
  **No payment is initialized**, settled or provisioned.

## Paystack test-only gateway binding

Once a Paystack test key has been saved and independently verified in
`/admin/integrations?provider=paystack`, an active verified Super Admin
may use `/admin/gateways/paystack` to bind that particular encrypted
credential version to a **test-mode** gateway. This is implemented with a
strictly disabled-by-default switch
`CLOUD_PAYSTACK_TEST_BINDING_ENABLED`. It requires the same documented
vault key custody, signed audit evidence, exact provider-vault PostgreSQL
schema, current account password and fresh unused TOTP.

The binding references the encrypted credential's immutable UUID/version.
It NEVER copies the underlying secret into the legacy
`payments_paymentgateway.encrypted_secret_key` column, and it rejects
an existing independently configured live gateway. A rotation, revocation,
expired verification receipt or mismatched version invalidates the
binding's ability to access a test key.

Test-only `PaymentGateway` state is `status=test` and `test_mode=true`.
The existing `payments.sandbox.sandbox_review_allowed` forbids test
checkout on Vercel Production even if the test binding feature is
enabled. This is intentional; a real Paystack test checkout should run in
a separately approved isolated Preview environment. Do not change
`CLOUD_GATEWAY_SANDBOX_READBACK_ENABLED` or
`CLOUD_ISOLATED_REVIEW_CONFIRMED` until Preview isolation is verified.

**Paystack merchant payment release is separate.** The existing
`payments_paymentgateway` record table uses legacy
`ENCRYPTION_KEY` Fernet for gateway keys. It is not automatically connected
to the provider vault: only an explicitly approved **test** binding stores
a pointer to a current encrypted credential version. A Paystack vault
readback or test gateway binding does not certify checkout.
A gateway configured without a hardened link, matching mode and verified
server-to-server settlement remains disabled. Do not duplicate a live secret
into the gateway by browser workaround or automatically enable all
`CLOUD_*PAYMENT*` flags. Official Paystack checkout requires server-side
initialize, signed event receipt, independent reference/amount/currency
verification, idempotent financial commit, and only then supported fulfillment.
Allow one small test-mode acceptance before a live transaction.

### Official Paystack evidence
- https://paystack.com/docs/v2/developer-tools/integration/api-keys
- https://paystack.com/docs/v2/api/balance
- https://paystack.com/docs/v2/api/transaction
- https://paystack.com/docs/v2/developer-tools/integration/webhooks
- https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html

## Domain price editor

Super Admin Console route: `/admin/settings/domain-pricing`.
API: `GET/POST /api/domains/admin/tld-price-cards/` (Super Admin only).
- Explicit NGN 1, 2, 5 and 10-year total prices for registration and
  renewal; optional periods are null, not fabricated.
- An annual transfer price can be supplied separately.
- Pricing edits require the Super Admin account password, fresh unused vault
  TOTP, optimistic
  revision, strict decimal syntax and an atomic audit receipt.
- Stored in existing `domains_tldpricing` with versioned
  `metadata.period_pricing_v1`. The original 1-year columns remain
  canonical annual fields. No new schema and **no migration**.
- New and edited cards are `inactive` drafts. They are not exposed as
  executable availability quotes or customer checkout options.
- When an approved registrar API exists, final buyer price must be
  validated against a fresh authoritative TLD/term-specific supplier cost,
  currency and availability; premium domains, registration restrictions and
  existing-domain ten-year cap require separate per-name checks.
- Terms of up to 10 years are not universally available. `null` for an
  unsupported length prevents falsely offering it.

Reference: ICANN Base Registry Agreement:
https://itp.cdn.icann.org/en/files/registry-agreements/base-registry-agreement-12-03-2026-en.pdf

## Evidence-led release order

1. CI passes all new TLD, Paystack-vault, existing payment, Django and
   Console tests on **one exact commit**. Merge only after that gate.
2. Since no Django model schema changes occur, DO NOT rerun DNS-01C or
   create an unnecessary new Production migration. Deploy same reviewed SHA
   to the existing separate API and Console projects; do not relink them.
3. Confirm the vault security status, independent key custody, migrations
   and existing Cloudflare verified read-only connection remain qualified.
4. Enable ONLY approved encrypted credential intake, then add and verify
   a Paystack **test** key through the Super Admin integration side sheet.
   Verify that no payment intent, invoice payment, gateway row or
   provisioning record was created.
5. Enter NGN domain pricing drafts with source-led supplier costs before
   any publication/quote pipeline.
6. Qualify a test-mode checkout with authoritative invoice and a genuine
   Paystack test payment, signed webhook and independent readback on an
   isolated approved environment. Do not use a fake success receipt.
7. Do not activate paid domain registration or hosting provisioning until
   verified provider-execution APIs, inventory, customer acceptance and
   refund/reconciliation controls are proven. Distinguish paid-but-pending
   fulfillment from successfully provisioned products.

**This batch deliberately adds no permission to modify Cloudflare DNS, charge
live cards, register a domain, renew a domain or provision hosting.**
