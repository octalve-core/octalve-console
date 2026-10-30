# Octalve Cloud — BIZ-02 evidence and OWASP release gates (30 Oct 2026)

## Scope and authority
- Six TypeScript/Tailwind reporting workspaces: Overview, Finance, Customers,
  Renewals, Providers and Report Library. Shared Desktop/Mobile ResponsiveTable,
  Lucide icons and medium typography. No HTML prototype figures in Production.
- Django `GET /api/reports/business-intelligence/?currency=NGN` requires an
  authenticated actual Admin/superuser (not role text alone), with no shared
  server/CDN cache. No writes, migrations or supplier interaction.
- First paint makes **one** bounded read (rather than the previous five).
  Report library metadata is loaded on selection, with exports/generation still
  disabled until private storage and per-file access receipts are certified.
- Reports are scoped to a user and currency in per-tab memory for display only.
  HTTP response `Cache-Control: private, no-store` is authoritative.
  Auth changes and mutations clear the cache and invalidate old read generations.
  In-flight responses from an old account cannot populate the current view.
  Automatic focus reconciliation is throttled; no polling, no manual refresh.

## Definitions — do not conflate these figures
- "Gateway-verified payment records": successful *payment* transactions with
  `webhook_verified=True`, `paid_at` present and matching ISO currency.
  These are **not** bank-settlement or recognized accounting revenue.
  Unverified gateway transaction states, pending events, deposits, refunds and
  different currencies do not inflate the subtotal.
- "Paid invoices": local invoice status and timestamp only; cannot establish
  that funds settled. Invoice due-date classification uses recorded timestamps.
- "Paying customers": distinct clients with gateway-verified payment events.
- "Renewal invoices": invoices explicitly tagged `metadata.type=renewal`;
  paid invoice status does not authorize domain renewal or supplier execution.
- "Active service/provider counts": local service records, not vendor uptime,
  supplier provisioning proof or inventory evidence.
- "Provider margin/profit": NULL until actual supplier costs, payment settlement,
  exchange rates, tax, refunds and matching ledger evidence are reconciled.
- Zero is used only for valid empty database queries. Errors and unavailable
  information must be visibly distinct from zero.

## OWASP risk verification and tests
- API1 Broken Object Level Authorization: unauthorized Client, Staff and
  `role=admin,is_staff=False` actors cannot read global snapshots; no
  customer identifiers are returned in the aggregate endpoint.
- API3 Broken Object Property Level Authorization: response contains approved
  fields only, no gateway credentials, raw webhook payloads or supplier config.
- API4 Resource Exhaustion: bounded 12-month series and top-12 provider
  distribution; compare database query count under disposable test data.
- API5 Broken Function Level Authorization: authenticated Admin-only GET;
  POST fails; reporting exports remain disabled.
- Session security: HttpOnly BFF, server authorized GETs, no browser token
  storage or service-worker persistence, scoped read generations and
  no-store response.
- Tests: `backend/reports/test_business_intelligence.py`, existing
  `backend/reports/test_financial_visibility.py`, security checks, Django
  suite, Next typecheck/build, disposable PostgreSQL auth schema.

## Important remaining qualification (not implemented in BIZ-02 reporting source)
- Real authenticated Admin/Staff/Client browser acceptance at six widths and
  network/p95 latency baseline, including 403/401/mutation/account switching.
- Bank statement and gateway reconciliation, refund/cost ledger, tax and
  per-provider supplier-cost snapshots **before** monetary profit displays.
- Report generation/private downloads: immutable export audit, file ownership,
  expirations, retention and authorized stream; no public media URLs.
- Customer risk flags: define and audit canonical flag authority before
  displaying "flagged customers" as an accurate metric.
- Service/domain transfers: **do not implement as simple client_id UPDATE**.
  Independently qualify initiating owner and receiving account authentication,
  step-up MFA, registrant/registrar verification, provider acceptance, cooling
  periods, domain restrictions, idempotent intents, signed audit receipts,
  compensating rollback, invoice and liability ownership. Existing service/
  domain IDs and billing ledger must retain historical traceability. No transfer
  mutation is enabled by this reporting batch.
- Legal signoff and public website deployment are separate from this Console
  reporting source PR.

## Production release procedure
1. Review the exact branch diff; run security tests, Django suite, frontend
   typecheck/build and disposable PostgreSQL qualification.
2. Merge qualified commit to `main` only; no Preview deploys.
3. Compare Vercel Production project deployment SHAs against merged `main`
   for both Console and API. Deploy exact commit to Production only if needed;
   never claim "live" from a previous READY deployment.
4. Check alias assignment, live public health and role-authenticated routes.
   Record deployment IDs, SHAs, rollback candidate and any failed acceptance.
