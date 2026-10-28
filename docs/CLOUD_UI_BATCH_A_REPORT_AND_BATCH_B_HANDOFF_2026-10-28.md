# Octalve Console — Batch A implementation and Batch B handoff
**Date:** 2026-10-28
**Reference:** `octalve-core/octalve-invoice` (UI design patterns only)
**Baseline:** Console main `b07808875f580cab33a89a89944fcaf087251f94`, reviewed Batch 1 PR #83.

## Scope completed in Batch A (source)
- The Invoice-style reporting experience is translated into Console's existing `/admin/reports` route without migrating Invoice's data, ledger logic, preview fixtures, PDF code, logo asset, or React state services.
- Actual Django reporting source contracts examined:
  - `/reports/definitions/`: access-controlled published report definitions.
  - `/reports/instances/`: generated report history (read-only access).
  - `/reports/financial/revenue_summary/?period=day`: paid invoice count over the backend's rolling **30-day** window.
  - `/reports/financial/revenue_by_gateway/`: successful payment **transaction counts** by gateway over 30 days.
  - `/reports/financial/revenue_by_product/`: paid invoice **item counts** by description over 30 days.
- **Critical accounting distinction:** financial backend aggregate currently sums invoice totals and transaction amounts without a returned currency dimension and without proof of payment settlement. The UI intentionally **does not** display mixed-currency monetary totals, balances, or an invented NGN revenue chart. It renders audited count-based category bars only. This is an explicit Batch B backend-interface review gate, NOT an authorization to change the backend.
- The report replaces the generic source table with a responsive visual dashboard (metric cards, top gateway/item count bars, report-definition cards, generated-report cards, loading/partial failure states, trustworthy period/source descriptions).
- Reuse existing Console `ActionButton`, `Panel`, `ResponsiveTable`, `StatusBadge`, `ConfirmDialog`, `DashboardShell`, `DashboardPage`, and `WorkspaceNavTabs` as the canonical foundation. Do **not** scaffold duplicates or run shadcn init against the running app.
- Added shared `ConsoleIconTile` reusing **Lucide SVG icons**, same family/presentation pattern as Invoice. The Invoice **brand icon image** is a separate product asset and is deliberately not used to replace Console branding.
- Added `AdaptiveSheet`: native dialog that presents as a centered desktop modal and a safe-area-aware mobile bottom sheet, with native keyboard focus and Escape cancellation.
- Added `AdminReportsWorkspace.module.css` for responsive report grids and `AdaptiveSheet.module.css` for scoped bottom-sheet geometry. These protect against Console's unlayered legacy `.grid` rules and do not expand `globals.css`.
- Reusable button/card/table controls already exist in the primary design-system folder and remain unchanged to protect their callers; Batch B will migrate all feature consumers to their standardized variants.

## CSS retirement evidence
- PR #82 merged: exact duplicate alert rule and duplicate PostCSS config removed.
- PR #83 merged: shared StatCard migrated to Tailwind; seven exclusively owned `.stat-card`, `.stat-label`, `.stat-value` CSS rules retired. Global stylesheet at **8,504 lines** on Batch A base.
- Batch A report page formerly used the generic AdminOperationListView, which did **not** have exclusively owned, report-only global selectors. Its new styles are owned by the report CSS Module, so removing broad global `.grid`, `.table`, etc. would be unjustified and harmful.
- **No additional legacy global CSS selectors deleted in Batch A**. Continue same-PR deletion only when source ownership and six-width browser evidence prove safety.
- Do not claim root CSS can be deleted: Tailwind v3 entry directives and global base still need one imported stylesheet. End goal is compact root CSS + local CSS Modules; line-count is a *target*, not proof.

## Qualification requirements
1. Source audit must show no demo fixtures, invented activity, financial default totals or write calls. Use `Promise.allSettled` to preserve truthful independent failures; malformed API results must display unavailable, not zero.
2. TypeScript, Next production build, CSS modules emitted, source UI contracts, Django isolated API suites and security CI all green on exact PR head.
3. Authenticated browser screenshots + interaction at **320, 360, 390, 768, 1024, 1440** for `/admin/reports`, including empty, partial outage, valid counts, keyboard navigation, sheet open/close, mobile scroll and focus return.
4. Other routes smoke parity and 810 full route/viewport evidence remain final acceptance gates; don't claim completion based only on CI.
5. No payments, writes, service provisioning, live exports, communications, model migrations or financial mutations triggered by reports UI.

## Batch B — detailed implementation prompt
Continue Octalve Cloud Console from the **verified, qualified Batch A merge SHA**, repository `octalve-core/octalve-console`. Read `docs/CLOUD_UI_INVOICE_GRADE_THREE_BATCH_MIGRATION_2026-10-28.md` and this document before coding. Reference `octalve-core/octalve-invoice` **only for presentation** and retain Console's blue/navy brand and authorization boundaries.

**B1 — Canonical design-token and component inventory.** Audit Admin/Staff components and all use of `ActionButton`, `Panel`, `ResponsiveTable`, `StatusBadge`, `ConfirmDialog`, `AdaptiveSheet`, `ConsoleIconTile`, `WorkspaceNavTabs`, and dashboard shells. Standardize visual variants for 11/12px metadata, readable body copy, controls, density, radii, surfaces, hover/focus/disabled, arrows, status indicators, empty/loading/error states. Keep icons as typed named `lucide-react` imports; do not import Invoice's logo asset. Add no duplicate global CSS override or separate React state library.

**B2 — Admin desktop/mobile migration.** For all **85 Admin** routes, partition by independent navigation/modules: reporting, catalogue workbench and product/plan views, records tables, customer/order/invoice/domain/billing, service/provisioning/integrations, support and settings. Keep existing loaders, BFF, mutation constraints, Django role checks and return paths; migrate only presentation to canonical components. Use AdminReportsWorkspace's report/metric visual pattern in other dashboards only if genuine validated backend data exists. Keep responsive tables for raw rows but do not use generic tables as report summaries. Confirm 320/360/390/768/1024/1440 widths, keyboard, touch, overflow, drop-down layering, dialogs/sheets, permissions and copy.

**B3 — Staff role migration.** All **10 Staff** routes must use the shared design tokens and shell while maintaining exact staff route permissions, readback and escalation/approval boundaries. Never duplicate Admin navigation to expose unauthorized actions. Test staff authentication/denials, mobile drawer, bottom sheets and table row actions, optimistic/pending state, errors and pagination.

**B4 — Same-PR CSS retirement, per bounded module.** Run `node frontend/scripts/audit-css-ownership.cjs --json frontend/.next/ui-css-ownership.json --check`; parse CSS with PostCSS AST, trace all active class consumers and dynamic/conditional/portal states. For each converted module, remove all obsolete selectors proven exclusively owned by that module **in the same PR**, update frozen SHA/size/line inventory, update positive/negative tests, and preserve owners elsewhere. Prioritize collision-prone `.grid`, `.table`, `.button`, `.card` only after all consumers removed. Complex visual styles should be feature-local `.module.css`; don't hide legacy globals in a second giant file.

**B5 — Reporting finance qualification (separate authority gate, no silent backend modification).** Investigate Django financial report aggregation: use currency-qualified, date-scoped, lifecycle-safe data contracts; avoid showing paid invoices as bank-settled cash. Resolve multi-currency and rounding semantics only through explicitly reviewed backend/API contract and permission work. Until then, keep amount charts/export disabled or labeled unavailable. Verify export authorization, file URLs and data provenance before enabling downloads.

**B6 — Verification/release.** Run frontend TypeScript + Next production build + CSS ownership + tests, Django and security suites, and signed authenticated browser visual evidence for all **95 Admin + Staff routes × six viewports = 570 cases**. Check empty/error/pending states, mobile sheets, keyboard, focus and screen reader names, screen-specific pagination and data truthfulness. Review PR source and test logs, merge only qualified source, and verify exact Production SHA on Vercel if access/rate limits permit. **No claim of live deployment without deployment evidence.**

**Batch B acceptance:** shared UI tokens/primitives reused, 95/95 route presentation qualification completed, no backend security/commerce regression, source-owned CSS removed in each reviewed migration, legacy stylesheet measurably shrunk with recorded exact rules and no invisible fallback, readiness and currency totals truthful. Produce explicit Batch C handoff for 33 Client and seven public/auth routes plus final 810-case global CSS retirement.
