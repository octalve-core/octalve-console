# Octalve Cloud — Batch 9: Dynamic catalog navigation and canonical client records
Date: 2026-10-27. Baseline: `530fdbc0a6214d8b2ff9f36942c00065b80efe60`.

## Decisions
- Single client sidebar label **Purchases**; `/client/purchases` links to the existing /client/orders and /client/invoices without changing order or invoice authority.
- **Language is only within /client/settings**, never a top-level sidebar link. English remains the only available locale until the approved i18n Batch 14.
- Services opens a nested navigation for My Services, Order New Service, and **every Admin-published, eligible category** loaded from Django. Domains includes My Domains and Register New Domain. Don't list transfer until Batch 11 implements an honest transfer eligibility/sandbox workflow.
- No hard-coded VPS, WordPress, dedicated, SSL, business email, or future category names in sidebar. The catalogue records and category slugs come from Admin-managed Django models; unlimited future adapters can publish offers without changing navigation.
- Generic Client table reuses `CloudRecordDirectory` from the existing Console. This is the single desktop/mobile design reference; no duplicate styling or separate table implementation. The action popup is centered desktop and bottom sheet mobile.
- No invented customer records, provider metrics, domain prices or success messages.

## Real catalogue capability boundary
`GET /api/storefront/categories/` returns only category slugs/name/description when an active/public product under it has an active/public, published plan and a positive, active billing cycle. No provider secrets, mapping IDs, costs, stock, customer data or draft plans escape. A category's appearance is **discovery only**, not proof it can be ordered. The BFF allows exactly this new storefront GET path.

The currently validated order serializer accepts `shared_hosting`, `wordpress_hosting` and `vps` only. The existing order page retains that restriction in its plan loader and filters eligible plans by category slug. Categories whose fulfilment contract is not yet approved lead to a clear no-online-checkout state, rather than an unauthorized transaction.

### Future adapter expansion (Batch 10/11 / Phase 4)
- Add a typed provider capability/fulfilment registry on Django, keyed by a stable product/offer capability ID **not** by frontend labels, price or untrusted adapter strings.
- Verify server side: active published offer/revision, inventory, provider operation permission, package mapping and health, server-calculated quote and supplier cost, idempotent lifecycle, reconciliation, compensation/rollback, and outbox status.
- Only after Django quote/checkout and provider acceptance are both qualified may a category become online-orderable; implement true capability flags in API and relevant checkout components then.
- New provider adapters remain isolated modules with no service-specific hardcoded sidebar configuration. External transfer/DNS/hosting calls require explicit sandbox certification.

## Accessibility and reuse
`ClientEssentialRecords` now maps verified normalized Client records into canonical `CloudRecordDirectory` rows and links to the same verified detail URLs. Table provides search, status filter, pagination, semantic desktop table, mobile cards and responsive options dialog. A modal focus trap/restore, Escape, Tab cycling and scroll locking follow [WAI-ARIA APG Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Keyboard, screen reader and viewport parity across all 123 authenticated routes **remains unqualified** until real browser evidence exists; source-level tests do not replace it. Legacy CSS stays protected.

## Scope acceptance
- No Django migration files; the new storefront endpoint queries existing database models.
- No payments, registrar writes, DNS updates, hosting provisioning, reward/affiliate changes, language conversion or OPanel service authority modifications.
- GitHub exact-head TypeScript, Next build, canonical style, catalogue public tests, Django/security/disposable PostgreSQL qualification. Then merge on existing `review/cloud` to `main` and inspect both Vercel deployments.
- In Batch 10 expand service usage, verified product-type adapters, renewals and OPanel management.
- In Batch 11 implement registrar-backed transfer, registration, renewals and DNS authority.
- In Batches 12–14 add notifications/Clan, points+affiliates, and translations (Settings).
- Final Batch 15 includes authenticated 123x6 visual/functional acceptance, CSS retirement and launch review.

## Route manifest change recorded after implementation

Batch 9 added authenticated `/client/purchases` and `/client/settings`, increasing
Client routes from 23 to **25**, and the complete Console inventory from **123 to 125**.
The signed real-browser acceptance matrix therefore increases from 738 to **750**
route/viewport cases. Updated static CSS and browser-parity count gates; no evidence
has been fabricated or treated as completed.
