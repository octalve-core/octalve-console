# Octalve Console — Batch 4: Commerce and Billing (2026-10-27)
Release baseline: `ef97dd0f2977c8913aced2c34d97e61ae5892608` (Batch 3).

## Included
- Published hosting offers only: `ClientOrderView` still obtains plans with `loadSellablePlans()` (public Django catalogue). `HostingPlanCards` and `HostingOrderSummary` show prices, features, billing cycles and the existing order route using Tailwind and Lucide.
- Checkout presentation: `CheckoutProgress` and `CheckoutQuoteSummary` extract UI while original `ClientCheckoutView` retains checkout ID/fingerprint in sessionStorage, UUID, server-quoted totals, coupon and selected offer revision, account details, terms acceptance, confirmed order + unpaid invoice lifecycle. No gateway transaction begins on the plan page.
- Client invoice/order lists and detail pages: typed responsive tables, filter/search/pagination and honest record detail cards using **only existing authenticated resource loaders**. No fabricated customer records or payment events, and no Staff/Admin directory changes.
- Hosted payment: `ClientProcessingView` still polls actual invoice state, verifies enabled payment options and HTTPS Paystack/Flutterwave hostname allowlist before redirect. Gateway return page does not treat browser redirects as proof of payment.
- Wallet display: real `clientApi.wallet()` only. Loading/unavailable never silently becomes a fabricated zero. No top-up or transaction feed invented.

## Outside this batch
- **Subscriptions:** the repo currently has no dedicated Client subscription-management `page.tsx` route or verified subscription API presentation contract. Do not fabricate a renewal flow, tier prices, or subscription status. Record this gap and evaluate once backend changes are authorized **after Batch 8**, or as frontend-only work if an existing verified API contract is identified during subsequent audit.
- **Transactions:** no dedicated Client transactions route is published. Use actual issued invoices, confirmed payment status and real wallet readback in available views; do not construct an event feed without authorized data.
- Older `components/modules/PlanCards.tsx` and `CheckoutFlow.tsx` contain legacy static-catalogue presentation and are not connected to the API-backed Client checkout migrated here. They are not promoted into the active customer purchase flow.
- All Backend/API, SSO, session, roles, pricing, checkout, provider, payment and customer authority logic remains unchanged. No migrations, sample records, charge initiation, hosting purchases, CSS additions or modifications. The Batch 0 stylesheet manifest stays valid.

## Release gates
- TypeScript/Next production build, Batch 0–4 source + generated Tailwind checks.
- Existing Django security and API regression and disposable PostgreSQL BIZ-01 gates.
- Review `review/cloud` exact-head PR diff before merging into `main`.
- Production frontend/API deployments must both be READY at merge SHA and have their expected aliases.
- Real authenticated browser purchase-path verification (without collecting funds) and 320/360/390/768/1024/1440 responsive acceptance remain outstanding until visually checked.
