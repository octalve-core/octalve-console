# Octalve Cloud — Invoice-grade Workspace UI Plan (29 October 2026)

**Baseline:** Console `main` `4d94b0acf84d6c56f65e585b8ad765d4165c2ba1`; Invoice `main` `6bfa293ebbc29bc0c9fa4f14d2a6fd301b862a64`.
This document is a source-backed design and delivery plan, **not** a claim of authenticated browser acceptance. Invoice is a merchant-preview; never transplant its fixture records or simulate successful mutations in Cloud.

## Observed root causes (live screenshots + source)
1. Sidebar: Console `DashboardSidebar.tsx` has `overflow-y-auto` without the hidden track treatment used in Invoice. Shell uses independently scrolling desktop main; keyboard/wheel scrolling must remain intact.
2. Huge mobile Customer cards: `ResponsiveTable.tsx` renders EVERY column as a vertical `dt/dd` pair. Invoice's actual active implementation is `src/features/records/components/RecordDirectory.tsx` + `RecordVisual.tsx`: record-kind icon, name, reference, amount, status, date and one trailing MoreVertical.
3. Detached primary action: `AdminResourceListView` passes Add customer to the outer `DashboardShell.actions`, which renders ABOVE `DashboardPage`, leaving a detached blue button and excessive top gap. Invoice places create alongside search/filter/export in the directory toolbar (full width on mobile).
4. Loading panel: `AdminResourceListView` begins with `isLoading=true` and `useAutoSync` launches an authenticated `config.loader()` fetch on mount, displaying `LoadingState`. The first screenshot is expected asynchronous UI, **not evidence of a measured backend outage**. Diagnose network timings before claiming slow SQL. Keep fetch errors different from legitimate empty lists; skeletons are presentational only.
5. Wrong fields: `AdminResourceListView.normalizeRecord` searches `name`, `created_at`, generic `amount` and maps `status` to `meta`. Actual `CustomerListSerializer` returns `full_name, email, company_name, date_joined, services_count, total_invoices, unpaid_invoices, wallet_balance, status, role, last_login`. Hence email duplication, status under Reference and missing dates; use type-safe per-resource mappers. Never infer amount or status from unrelated fields.
6. Backend `AdminCustomerListView.get_queryset` joins services and invoices in one aggregation; inspect count/sum correctness with multi-service/multi-invoice fixtures before relying on aggregates. Wallet method field may cause one query per list row; benchmark query count, don't guess. Permissions remain `IsAdminUser`.

## Design baseline (all roles, Tailwind v3 + TypeScript + Lucide only)
- Cloud identity #000A16 sidebar, #0064E0 blue; white cards, #F8FAFC background; muted text #64748B; soft blue/green/amber/red status tones; medium `font-medium` (500) throughout, including KPI figures.
- Desktop: pinned 64px header, 256px sidebar, independent scroll; no visible thick scrollbar track; 13–14px content, 20–24px page headings, 12px table headings, compact 36–40px controls, 8–12px radius. Preserve scrolling, focus and reduced motion.
- Directory desktop: title/subtitle without detached action. Status pills at top of card; second toolbar [count, search] LEFT, [Export if authorized, Filter, primary Create] RIGHT; gray narrow header row, very light rounded row surfaces, 36–40px icon circles and semantic status chips. End column is a keyboard-accessible MoreVertical action.
- Mobile: compact page title/back (role routing), search + filter icon + optional Export, full-width Create if authorized, horizontally scrollable status pills, concise stacked records (icon; title/name+amount; reference+status; created/due), no duplicate dt/dd inventory. Trailing MoreVertical opens safe-area-aware bottom sheet; same dialog centered on desktop.
- Mobile primary navigation: add one role-aware 4–5-item fixed bottom bar with active blue state and accessible labels, generated from the existing authorized navigation model. Keep secondary items in the drawer; respect iOS safe-area, onscreen keyboard and content padding; never expose Admin entries to Client or Staff.
- Row action model: `view` link + optional domain actions from server-visible capabilities and client permission model; all writes still backend authorized; disabled/unconnected actions omitted or accurately explained. Destructive actions must require confirmation, server approval, and auditable receipt. Never bind purely decorative buttons.

## Batch UI-01 — Workspace shell and reusable foundations
- Scope: `DashboardShell`, `DashboardSidebar`, page heading placement, `Panel`, `ConsoleIconTile`, status/toolbar tokens; replace large centered directory loader with adaptive row skeleton. Establish the shared authorized mobile-bottom-nav shell before migrating role directories.
- Preserve `globals.css` <=300 lines (currently 52). No new global component CSS and no duplicate shell. Move detached create actions INTO directory toolbar in UI-02 rather than copy them into a second heading.
- Desktop and mobile edge checks at 320, 360, 390, 768, 1024, 1440; no clipped navigation, page horizontal overflow, lost focus/scroll or unscrollable sidebar.
- Gate: strict TS, Next build, contract tests and route parity; no API/security changes.

## Batch UI-02 — Canonical typed Record Directory
- Build folder `frontend/src/components/design-system/record-directory/` with small components: `DirectoryToolbar`, `StatusTabs`, `DesktopRecordTable`, `MobileRecordCard`, `RecordActionMenu`, `RecordActionSheet`, `DirectoryPagination`, `DirectorySkeleton`, `types.ts`.
- Extend/deprecate existing `ResponsiveTable` and `CloudRecordDirectory`; **do not create another parallel long mega-component**. One controller manages search/filter/page/selection; data adapters own formatting and auth rules.
- Use the existing `AdaptiveSheet` native dialog, migrating its scoped CSS to Tailwind utilities where possible; must focus trap, restore focus, close on Escape, lock backdrop scroll, support 320px and safe-area bottom padding.
- First complete Admin Customers as the golden master; then migrate Admin invoices/orders/services/domains and Staff/Client records in small typed groups. Mobile identity uses each business resource's meaningful fields; desktop displays only documented server fields.
- Gate: actual invoice-inspired desktop/mobile visual parity, a11y keyboard, no fake Export/Send/Delete, no cross-role route leakage, snapshots at all six widths on golden-master route; preserve existing action permissions.

## Batch UI-03 — Backend truth, performance and full production qualification
- Establish exact `CustomerListSerializer`/schema, payments, invoices, domains, orders, services, support and audit mapping. Normalizer must never map `status` to a reference or repeat email as person name if `full_name` is available; present `—` only for genuinely absent authorized fields.
- Use server-side query/search/status/date/sort/pagination with explicit `count,next,previous,results`; never cap 10 client-side on an incomplete API page. Reset page on filters, debounce searches and cancel stale loads; background refetch never blanks valid data. Scope cache by authenticated principal and clear on logout, no browser JWT storage.
- Benchmark API latency, auth BFF, customer wallet N+1 and joined Count/Sum correctness under multi-related fixtures. Only modify Django when a test proves need. Security: DRF role/ownership, signed BFF, output whitelists, no secret fields, immutable invoice/payment authority, audit receipts.
- Add non-PII RUM/request timing and errors: route navigation, API completion, list empty/loading/error, slow response. Prefer compact row skeleton/optimistic navigation, **never** claim API success before response.
- Qualify the 135 route x 6 width (810) authenticated matrix with reviewer screenshots, browser console/overflow checks, keyboard/sheet/checkout and role restrictions. A green build is not a browser visual pass. Roll out to Vercel only after owner review and exact SHA checks.

## File hygiene and release gates
- Target `app/**/page.tsx` <=120 lines; view components <=300 lines; individual reusable modules <=250 lines; **no page or single component above 500 lines** without exception review.
- Keep per-feature folders for columns, data adapters, hooks, views, actions and tests. Define discriminated unions for status and typed `RecordRow<T>`; never pass raw loosely typed Django payload directly into markup.
- Existing billing, catalogue, SSO, provider, rewards and role contracts remain authoritative. No unqualified provider/payment activation, database migration or supplier credential handling in UI-only batches.
- Each batch: separate reviewed PR, exact-head green CI, role/viewport visual acceptance, single guarded merge and controlled Vercel release. Retain prior Production rollback SHA.
