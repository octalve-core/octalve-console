# UI-02 — Invoice-Grade Record Directory: Source Implementation & Acceptance Ledger

**Date:** 2026-10-29  
**Baseline:** `octalve-core/octalve-console` main `3c614d9960859fe8bd96bf1022e2fc58b5a3a904`.  
**Reference:** `octalve-core/octalve-invoice` main `6bfa293ebbc29bc0c9fa4f14d2a6fd301b862a64`.

## Delivered implementation (no speculative backend writes)

The implementation is in `frontend/src/components/design-system/record-directory/`:
`types.ts`, `RecordDirectory.tsx`, `RecordVisual.tsx`, `StatusTabs.tsx`,
`DirectoryToolbar.tsx`, `DesktopRecordTable.tsx`, `MobileRecordCard.tsx`,
`RecordActionSheet.tsx`, `DirectoryFilterSheet.tsx`, `DirectoryPagination.tsx`.

- One typed, 10-rows-per-local-page presenter: role-aware status tabs, controlled search, category/status/date filter, compact responsive rows/cards, measured counts of **loaded** API records and accessible keyboard-operable pagination.
- Toolbars expose Create only for an explicit existing route, and Export only if an actual authorized `onExport` implementation is passed. No placebo Export, Send, Delete, Pay, Provision or Gateway operation.
- Three-dot triggers use the same route-backed action model on mobile and desktop. Native `<dialog>` + `showModal()` supplies inert background and focus containment; the wrapper closes with Escape, backdrop and Close button, and restores focus when possible. Mobile sheet observes `safe-area-inset-bottom`.
- `AdminResourceDirectory` and `StaffOperationalDirectory` consume the shared components. `CloudRecordDirectory` is now a compatibility adapter to the same core, preserving existing client service/domain actions and exact-ID routing. No duplicate record markup or new API authority.
- AdaptiveSheet's old CSS Module is deleted, replaced with component-local Tailwind utilities; global CSS retirement remains intact.
- New reusable components are individually far below 250 lines. No new 500-line page.

## Admin Customers golden master — grounded fields

Actual Django API: `GET /api/auth/customers/` (`AdminCustomerListView`), protected by `IsAdminUser`.
`CustomerListSerializer` returns these fields:

| UI field | Server source | Mapping |
|---|---|---|
| Customer name | `full_name` | Preferred over email; email fallback only if genuinely blank |
| Email | `email` | Secondary field; never duplicated as name when full_name exists |
| Company | `company_name` | Exact value; missing becomes em dash |
| Customer identifier | `id` | `Customer #id` label; route uses encoded exact ID |
| Account state | `status` | Independent status badge; never category/reference |
| Joined | `date_joined` | ISO date parsed and displayed in `en-NG` |
| Wallet | `wallet_balance` | Only numeric explicit values formatted to 2 decimals; no assumed currency symbol |

`services_count`, `total_invoices`, and `unpaid_invoices` are intentionally **not shown as verified totals** pending UI-03 aggregation tests. The backend joins `services` and `invoices` in one query, which may multiply related rows; validate before showing KPI totals.

## Current API and pagination limits

The existing admin/client/staff list calls may return paginated subsets. UI-02 intentionally labels counts as **loaded** rather than claiming the whole server-side collection. Search, status and page slicing currently apply to loaded rows only. UI-03 will add evidence-backed server-side filtering, count/next/previous handling, concurrency and per-user scoped cache policies.

The Client/Staff adapters preserve existing server-returned records and role-specific routes. Some legacy generic Admin workspace directories still use the older `ResponsiveTable`; consolidate in later qualified groups, without pretending all 135 routes have been converted.

## Test evidence vs. outstanding browser verification

- Frontend TypeScript and Next.js production build: verify CI at exact PR SHA.
- New `check-ui02-directory.cjs` executes the pure customer normalizer with explicit fixtures, validates Django serializer field names and Admin privileges, and rejects fabricated values / unauthorised pseudo-actions. This is a **unit/source contract**, not browser proof.
- Existing catalogue, checkout, payments, domains, services, role and Django security regression checks remain enabled.
- **Not yet done:** genuine signed-in browser screenshots on the golden-master page. Required widths are **320, 360, 390, 768, 1024, 1440 pixels**. Check name, company, email, exact record ID, wallet field, status, date, mobile height, text overflow, Create positioning, pagination, keyboard, Escape and focus return.
- **Not yet done:** full `135 × 6 = 810` authenticated Console cases. These remain UI-03 and must never be marked green without actual evidence.
- No account credentials were supplied and the available browser profile does not have an Octalve Console authenticated session. This prevents verified signed-in screenshots in the current tool context.

## Release decision

**Draft PR — do not merge or deploy to Vercel Production until golden-master authenticated six-width visual acceptance is obtained.** A passing static build does not close this gate. Keep existing Production alias `4d94b0ac` as known working reference.
