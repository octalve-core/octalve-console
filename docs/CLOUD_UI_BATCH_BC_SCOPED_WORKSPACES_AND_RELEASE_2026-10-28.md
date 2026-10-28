# Octalve Cloud Console — UI uplift follow-up: Admin/Staff/Client scoped workspaces
Review base: `8730c3a251d96cf8aab57e4b71d0ef06f9500a24` (merged auth background, PR #91). Workstream is an incremental part of the approved 135-route/810-case modernization, **not final Batch B or C acceptance**.

## Implemented, no new business authority
- Expanded the existing canonical `WorkspaceGrid` with responsive `overviewPair`, `directory`, `responsive2`, `responsive3`, `responsive4` variants. All layout selectors are locally owned in `WorkspaceGrid.module.css`; no extra CSS global file or second grid primitive. The pre-existing `filters`, Admin/Staff/Client metric, and `quickActions` variants remain unchanged.
- Applied `overviewPair` to actual Admin, Staff and Client overview screens. Admin invoice/provisioning links, Staff support/provisioning state, Client services/invoice readback, loading/error states, API fetch effects and role/locale remain unchanged. One column below 1280px, two at XL with `minmax(0, 1fr)` for overflow-safety.
- Updated Admin/Staff quick actions to the same two-mobile/four-tablet `quickActions` grid and accessible `ConsoleIconTile` family already used by Client. Preserve exact four role-restricted destination URLs and focus-visible treatment.
- Replaced Admin settings directory's unlayered generic `.grid` with `WorkspaceGrid variant="directory" as="ul"`, retaining semantic `ul > li`, real settings links, one column on phones, two from 768px and three from 1280px.
- Refactored existing `ResponsiveGrid` without changing the public `children/className/columns` contract. Its 2/3/4 column breakpoints now use scoped variants, preventing the remaining unlayered `.grid` selectors from hijacking these common layouts.

## CSS retirement ledger
- **No global deletion in this PR**. Protected `frontend/src/app/globals.css` remains **8,460 lines / 153,180 bytes / Git blob `4bade3c74196118a0372adc60f94dcd7fa817ad1`**. It is still required for Tailwind v3 and many other feature consumers; changing or deleting global `.grid` or `.space-y-6` would affect other role screens.
- Latest run of `audit-legacy-css.cjs` reported **122/135 routes** with *possible* inherited legacy selector dependencies: Admin 80, Staff 10, Client 32, public/auth 0. These are **conservative lexical findings** and do not imply those routes are all visually broken. The `.grid` token had 92 route consumers in the report; one migrated component cannot retire its shared definition.
- Same-PR retirement will resume when each selector has exclusively qualified ownership and all states/breakpoints are reviewed. Never delete CSS based on a zero-string-count alone. Root global CSS remains the Tailwind entry even after final retirement.

## Source and build qualification
- `frontend/scripts/check-ui-uplift-workspace-migration.cjs` runs in CI before and after Next production build. It verifies role/dashboard module imports, scoped classes, responsive output, real links, preserved roles, forbidden mutation calls and exact legacy CSS baseline.
- Require TypeScript, Next build, frontend source/emitted CSS guards, Django isolated database and security checks at exact PR head before merge.
- **Not certified:** signed role-authenticated screenshots, keyboard/modal focus review, denied-role states, and actual computed-style inspection at 320/360/390/768/1024/1440. All **810** browser route/viewport cases remain pending until isolated Review identities and attestations exist. `browser-parity-qualification.cjs --plan` produces a plan, not evidence.

## Further batches approved but not completed by this source change
1. Admin/Staff route modules: catalogue and workbench, details/editors, services/hosting, customer operations, settings, payment gateway and support. Verify each React form state and source-owned CSS.
2. Client modules: domains/DNS, hosting/OPanel, checkout, purchases/invoices, support, notifications, account, wallet and rewards.
3. Backend separately: report generation/storage/ownership + currency/settlement and metric visibility tracked in issue #88. Never treat a frontend display fix as financial backend authorization.
4. Browser evidence tracked in issue #89: authentic role sessions are required, not synthetic screenshots. Confirm a secure Review user browser profile and safe fixtures, then do 135×6 verification.
5. Final root CSS cutover only after zero qualified legacy owners; Tailwind v3→v4 separately with browser support/visual diffs.
6. Vercel: no Production claim without READY deployment whose Git SHA equals merged `main`. Hobby plans have 100 deployments per 86400 seconds; do not attempt to bypass rate limiting with arbitrary unqualified builds.

## Source standards
- Next.js: CSS Modules are locally scoped and production CSS ordering may differ, so test `next build` and actual browser rendering. https://nextjs.org/docs/app/getting-started/css
- Tailwind v4 is a major upgrade with PostCSS, directive and browser support changes. Keep current v3 until distinct acceptance. https://tailwindcss.com/docs/upgrade-guide
- Vercel deployment rate limits: https://vercel.com/docs/limits
