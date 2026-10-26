# Octalve Cloud Console — Customer Experience, Production Copy and Remaining Release Gates
**Date:** 26 October 2026
**Scope:** Console only, production customer UI corrections, no schema/migration, payment or provider-write changes.

## Verified customer feedback and fixes
A logged-in client accessed `/client/order` and saw zero purchasable plans. This **does not establish an adapter fault**: the order UI accepts only a published, public, active hosting product with an active, positively priced billing period. It does not create dummy plans when the live catalogue is empty. Backend `catalog.PlanViewSet` filters published active public products; catalogue publishing remains supplier-cost/offer-authority gated. Real provider/plan mapping, retail offer, valid price/cycle and publication must be verified before selling.

The user also saw full-screen "Loading client dashboard — Fetching your account summary from the API" and "Connecting to the Django API" on other pages, plus internal catalog language. This work:
- Replaces the blocking dashboard loading panel with visible summary cards; each unknown metric shows `…` while retrieving and `—` when unavailable, not fabricated zero.
- Applies a **12-second deadline to read-only GET** requests, preventing a hung API call from creating an indefinite spinner. Does not time out or automatically retry ambiguous order/payment/provider mutation requests.
- Fetches **unpaid-only** invoice counts via the supported Django invoice status filter and shows actual (not demo) service and invoice records where returned. For source requests that fail, shows a non-alarming retry message and keeps the unavailable data distinct from empty.
- Adds a clear "no plans yet" customer message and support CTA; removes provider/catalog jargon and internal API references from prominent client screens.
- Removes misleading mocked header notification count and search input, makes Quick Navigation functional, and removes unsupported 24/7 support promises.
- Removes fictitious pending wallet deposits and applied credits, inactive wallet-funding button, fake fallback balance, and unsafe generic invoice checkout/placeholder PDF or DNS shortcuts.
- Removes random record IDs, invented "Active" status and fabricated resource scores from normalization; confirms account rows have stable API identifiers.
- Corrects profile fallback email and account security copy; removes developer route and API-status copy on details.
- Adds CI regression `frontend/scripts/check-production-customer-copy.cjs` on customer-facing screens. No DB migration.

## What still remains before commercial launch
1. **Publish genuinely qualified retail plans**, not demo inventory: actual active supplier offer, supported package/provider, immutable commercial revision, billing cycle, supplier floor, operator approval, public active status. No hosting sale until external provisioning can be delivered safely.
2. **Production frontend deployment:** GitHub `main` may already contain newer Console code, but Vercel production frontend was previously still pointing to PR #13 due to Hobby quota. Verify exact deployed SHA/alias. A merged PR is not proof customer UI has updated.
3. **Production API + database:** confirm existing Console MAIN Neon connection/ledger (never Vault), apply only reviewed pending migrations with backup and production authorization. Do not create new Neon DB/branch.
4. **Browser acceptance:** signup/login/logout/session refresh/protected pages; valid empty catalog and approved published offer; unpaid invoice remains unpaid; order/customer/amount isolation; idempotent order replays; no money or provider writes during smoke tests.
5. **External implementation:** real provider create/readback and recovery, OPanel files/list/publish/SSL site proof, merchant sandbox/financial reconciliation, registrar domain commerce, customer email delivery. These remain separately feature-gated.
6. **Customer UX next:** migrate remaining staff/admin placeholder widgets and unsupported convenience actions only after verifying the endpoints and operational contracts, rather than cosmetically labeling unfinished features as working.

## Production copy policy
- Prefer useful labels: **"Your services"**, **"Invoices awaiting payment"**, **"Updating your account…"**, **"We couldn’t load your information. Try again."**
- Never mention `Django`, `API`, `API-ready`, `catalog backend`, `sandbox`, `synthetic`, `CI`, `developer`, `production migration` in ordinary customer-facing UI.
- Avoid unsupported guarantees (`24/7`, `available balance = ₦0`, `3 notifications`, `live site`, `active hosting`), and don't show controls that have no working destination.
- Any empty state must distinguish no customer records from a failed request. Payment and provisioning authority are enforced server-side, not through messaging.
- Features that are not connected should remain unavailable rather than simulated.
