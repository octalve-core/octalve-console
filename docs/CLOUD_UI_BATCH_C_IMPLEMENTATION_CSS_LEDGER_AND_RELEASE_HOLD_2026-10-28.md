# Batch C source implementation, CSS ownership, and release decision
Date: 2026-10-28. Base: `82111e654a6d261ac71dc532fd39bf725b94354b`, security PR #86.

## Implemented presentation-only migrations
- `ClientOverviewMetrics`: existing service/invoice/domain/support counts and wallet value/unknown/loading states unchanged. Reuse `WorkspaceGrid variant="clientMetrics"`, `Panel`, `ConsoleIconTile`. Source of truth still `useClientSummary`, not a hardcoded array of numerical figures.
- `ClientOverviewActions`: preserve all four existing Client-only links and localization, but reuse the scoped two-up-on-mobile/four-up-on-tablet `WorkspaceGrid variant="quickActions"` and the same Lucide icon treatment used by Invoice/Console. No new operational action.
- `BillingRecordDirectory`: preserves invoice/order search, status filter, pagination, amount formatting and record detail route. Its existing desktop-native/mobile-card `ResponsiveTable` remains canonical.
- `ClientProfileDetailsForm`: keeps existing account fields, maxlength, onChange, submit/loading and no new API calls. Uses scoped two-column form layout and shared icon tile.
- `AuthLayout`: preserves approved Console brand panels/logo, copy, fields, terms/privacy links and auth logic. Replace legacy class `.grid` reliance with `AuthLayout.module.css`, owned only by the auth shell; no independent signup or OPanel customer login added.

## CSS and accessibility ownership
- Reuse existing `frontend/src/components/design-system/WorkspaceGrid.module.css` and `ConsoleIconTile` rather than creating duplicated Client primitives.
- One small `frontend/src/features/auth/components/AuthLayout.module.css` owns responsive 1-column/2-column auth panel geometry, registered exactly in the CSS baseline. No new global selectors or moving 8k lines into a hidden secondary stylesheet.
- `globals.css` stays **8,502 lines**, unchanged Git blob `9ae994d96118a54fe4e48411f39ec84b541478e3`. Migrated Client components were already Tailwind-classed; the only overlapping global selector `.grid` has other owners. **No globally owned CSS declarations can be safely removed from this migration on static evidence alone.** Bulk retirement remains blocked.
- Native buttons, forms, dialog focus, tables, existing BFF role gating, and hosted service SSO were not changed.

## Qualification and blockers
- New source/emitted-CSS guard `frontend/scripts/check-batch-c-client-auth-ui.cjs` is wired to CI. It confirms opt-in Client variants, all key state/callback tokens, owned CSS modules and no unqualified financial/provisioning calls.
- 40 Client/public/auth routes × six widths = **240 pending browser checks**; carry forward **570 Admin/Staff checks** = 810 total. The source route inventory is in `docs/CLOUD_UI_BATCH_C_CLIENT_PUBLIC_40_ROUTE_ACCEPTANCE_2026-10-28.md`. No signed screenshot evidence or actual authenticated browser interactions are claimed.
- PR #86's server-side financial-report permission tests and PostgreSQL CI passed. Currency-qualified settlement accounting/report generation/export remains a separate backend release gate. Do not add mixed-currency monetary charts or claim settlement from an invoice status.
- Do not remove `globals.css`: preserve Tailwind directives and legacy compatibility until each remaining owner is migrated and independently tested. Avoid automatic CSS deletion based on static class matching.
- Vercel Production must not be claimed updated until an exact deployed commit SHA is verified and acceptance gates pass; no live credential entry, provider invocation or customer payment may occur for UI tests.

## Required next source/acceptance batches
1. Per-module UI work on Client domain details/DNS/renewal, services and OPanel launch, support editor and notifications, checkout/return states and wallet/rewards; migrate only presentation, preserve all server authority.
2. Authenticated 320/360/390/768/1024/1440 captures for all 135 routes, including role-negative cases, dynamic route fixtures, keyboard focus, touch sheets, i18n, no overflow, data correctness, 2FA and account sessions.
3. Finish financial report export/generation audit as a separately tested security change. Ensure any report download has permission-scoped storage and cannot expose another client's file.
4. Once **zero legacy CSS consumers** and signed evidence are verified, replace global compatibility overrides with minimal Tailwind base/tokens, preserving route-owned CSS Modules; then independently decide whether Tailwind 4 is justified.
5. Only merge source that passes appropriate frontend/Django/security checks; do not promote to Production without exact SHA and verified browser runtime.
