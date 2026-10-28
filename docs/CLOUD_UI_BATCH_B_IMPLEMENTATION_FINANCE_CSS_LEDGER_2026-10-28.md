# Batch B — Finance reporting authority review and CSS retirement ledger
Date: 2026-10-28. Review base: `3d763bb8eb6241298203d9388230bba23c1412e6`.

## Actual implemented source scope
- A **single** design system under `frontend/src/components/design-system` still owns `ActionButton`, `ActionLink`, `Panel`, `ResponsiveTable`, `StatusBadge`, `ConfirmDialog`, `AdaptiveSheet`, `ConsoleIconTile`, `WorkspaceNavTabs`, `WorkspaceLayout`.
- Batch B adds `WorkspaceGrid` (owned `.module.css`) and accessible `IconActionButton`, keeping all callbacks and API authority external.
- Both Admin and Staff account overview metric components now use `WorkspaceGrid` and `ConsoleIconTile`. All numeric states still originate from their existing loader / typed count props. **Unknown stays `—`; no fake counters.**
- Admin generic directory, Admin resource directory and Staff operational directory use the shared 320px-first filter layout, while retaining the same search, status filters, paging, native forms, record links and role-aware data hooks.
- `AdminToolPage` now uses its own utility classes for its last legacy `.stat-icon` consumer. The tool's older fixture descriptions and sample stats have not been promoted into any new view or represented as live operations; audit any route using this old component separately before public exposure.
- No Admin/Staff route names were deleted or renamed. All **95** route sources are inventoried in `docs/CLOUD_UI_BATCH_B_ADMIN_STAFF_ROUTE_MATRIX_2026-10-28.md`.

## Exact same-PR CSS retirement
| Selector | Old owners | Migrated owner | Removed rules | Reason |
| --- | --- | --- | ---: | --- |
| `.stat-icon` | `StatCard` (already migrated in #83), `AdminToolPage` | Both now render locally styled icon wrappers | 2 | Last lexical consumer removed; global rules not required |

- Frozen `frontend/src/app/globals.css`: **8,504 → 8,502 lines**, verified blob `9ae994d96118a54fe4e48411f39ec84b541478e3`, **154,966 bytes**.
- New strictly scoped component stylesheet `frontend/src/components/design-system/WorkspaceGrid.module.css` recorded as an explicit approved file in `frontend/audits/console-ui-baseline-2026-10-26.json`. It is NOT a replacement global stylesheet; it handles only shared metric/filter grid geometry.
- Keep global selectors such as `.grid`, `.table`, `.card`, `.button` while other routes use them. Nothing else is authorized for bulk deletion. The root stylesheet remains necessary for Tailwind v3 and existing compatibility CSS.
- The source-side CSS owner scan is conservative and *cannot* qualify deletions or prove mobile screenshots.

## Finance/reporting contract findings — must not be hidden
Inspected source `backend/reports/views.py`, `backend/reports/urls.py`, `backend/billing/models.py`, and Console `frontend/src/lib/api/modules/reports.api.ts`.
1. `FinancialReportViewSet` uses only `IsAuthenticated`. Unlike report-definition list (`@permission_required('view_reports')`), the financial summary/gateway/product actions don't clearly enforce an Admin/report role permission. Their aggregate querysets are unscoped. **Potential cross-role aggregate visibility**. Security owner must reproduce with client/staff/admin credentials on isolated Review, add explicit report permissions/tenant scoping and negative tests. Frontend route protection is *not* backend authorization.
2. Revenue summary sums `Invoice.total` for invoices marked paid while invoices have a `currency` field, yet the result has **no currency breakdown**. Payments and invoices cannot be added across currencies.
3. Gateway aggregation counts successful `Transaction` entries (not bank-settlement proof), while item aggregation counts `InvoiceItem` entries attached to paid invoices. These are different business events and must not be labeled identical or added as cash revenue.
4. `period=day` is a rolling 30-day interval in the current backend; `period=month` is a rolling 365-day interval. There are no qualified arbitrary date-scoped reconciliations in the queried endpoint shape. Do not build clickable date filters that cannot be honored correctly.
5. `ReportDefinitionViewSet.generate` currently creates a report instance and accesses `default_storage` in its success and deletion paths without a local import in the inspected view. Generation, exports, deletion, permission/ownership and immutable receipt safety require a **separately reviewed backend security gate** before activation.

**Release policy:** this Batch B source PR does NOT modify Django, financial endpoints, signed BFF paths, role permissions, prices, checkout, provider credentials or payment code. Do not claim B5 financially qualified; keep mixed-currency totals and exports unavailable and obtain backend security approval in a **separate, test-backed permission/security PR** before exposing sensitive reporting data more broadly.

## Acceptance status (as sourced)
- CI source contract, TypeScript, Next build, CSS emission, Django isolated API and security: **pending until this PR HEAD checks complete**.
- Authenticated browser 85 Admin × 6 widths = 510 and 10 Staff × 6 = 60, total **570**: **PENDING**. Require screenshots, focus/keyboard/touch, overflow, status/no-data, conditional modal/sheet and denied role actions per route. Zero artifacts have been claimed by this source work.
- Production Vercel exact SHA: **not claimed** without separate deployment evidence.

## Batch C (Client + public/auth, final CSS)
After qualified Batch B source and signed Admin/Staff browser evidence: migrate 33 Client and 7 public/auth routes, covering customer auth, published catalogue, invoices, payments, hosted-service ownership / Console→OPanel SSO, domains and account/support workflows. Preserve real Django authority. Reuse canonical tokens, scoped UI primitives and responsive Invoice-style cards/icons/sheets. For each migrated component, remove only exclusively owned global CSS in the same PR, update blob/SHA and negative regression test, and retain any shared selector used elsewhere. End only after 135 routes × six viewports = 810 genuine signed browser cases, financial/readiness truth checks, backend security tests, and exact reviewed deployment SHA. Do NOT delete the Tailwind entry stylesheet; retire only the unsupported legacy overrides.
