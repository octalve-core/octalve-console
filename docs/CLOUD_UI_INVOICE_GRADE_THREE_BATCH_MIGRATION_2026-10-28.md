# Octalve Console — 3-batch Invoice-grade web UI modernization
**Approved user direction:** responsive mobile and desktop Console, preserving backend/security, adopting `octalve-core/octalve-invoice` architecture as a reference (NOT copying its operational data, branding or invoice templates).

**Starting main:** `e42fd96430a232863f1bb8cd9afe4dc360d6bfb6` (PR #82 merged, GitHub frontend/Django/security green). Console's legacy root stylesheet is currently 8,516 lines. Invoice root CSS is 472 lines, but Invoice also uses a 925-line document CSS and two template CSS Modules (571 and 800 lines): the objective is cleaner ownership, **not artificially shuffling thousands of selectors to new global files**.

## Invariants across ALL batches
- No Django model, migration, permission, REST serializer, payment, BFF signed proxy, catalogue price, publishing, order/checkout, ownership/SSO, OPanel launch or provisioning changes. Frontend must not invent readiness, success statuses or client account data.
- Preserve URL paths and existing typed component contracts, callbacks, form state, loading/empty/error states, tables, focus management, invoices/PDF print styles, translation context and browser back/forward.
- Admin, Staff, Client and public/auth have independent role evidence. The existing responsive six widths (320, 360, 390, 768, 1024, 1440) × 135 routes = **810 cases** remain the complete signed-acceptance requirement.
- **Same-PR retirement rule:** whenever a component/route is migrated, identify its legacy selectors and remove only those whose full ownership and interactive states have qualified. Record replaced selectors, affected routes and visual evidence. Never carry a growing compatibility stylesheet as an untracked fallback.
- A class token with zero static references is a **review candidate**, not automatic deletion authority: names can be constructed at runtime, supplied by external scripts, used in portals or injected HTML, or referenced by CSS pseudo/media rules.
- One canonical PostCSS configuration, one authoritative Tailwind config for the currently deployed version, no broad CSS selectors appended to `globals.css`, no arbitrary plugin initialization or simultaneous switch to Tailwind 4.
- No CSS-delete PR may merge on a green TypeScript build alone; source contract checks, emitted CSS check, visual and role-authenticated acceptance, Django regressions and security checks must all be appropriate and successful. No Production deploy without exact merged SHA confirmation.

## Batch 1 — Architecture & ownership (now)
**Purpose:** put the foundation in place without changing all 135 screens simultaneously.

**Structure:**
- Existing `frontend/tailwind.config.ts` is current authority for v3; one PostCSS MJS. Adopt canonical `console` color tokens plus opt-in `rem` typography, spacing, layout widths, surfaces and radii. Do not overwrite tested colors or globally adjust all screen margins.
- Existing `components/design-system` remains the shared source of primitive contracts. Introduce typed, responsive wrappers (WorkspaceContainer/WorkspaceSection) and module-specific `.module.css` ONLY when a specialized visual cannot reasonably use Tailwind classes.
- Existing DashboardShell/Header/Sidebar/MobileDrawer stay the only navigation and role shell; add responsive composition through components rather than separate page implementations.
- Audit **all** CSS rules with PostCSS, scan all TSX/TS/JSX/JS/MDX source for possible ownership and generate machine-readable `frontend/.next/ui-css-ownership.json`. Mark collisions (`.grid`, `.card`, `.table`, etc.) and dynamic references as manual-review risks.
- Review representative Client, Staff, Admin and authentication screens at all six widths for use as future golden baselines.

**Retirement:** exact redundant blocks/duplicate configs were already removed in PR #82. Each additional migrated Batch 1 component must retire its verified exclusively owned CSS in that same PR, with explicit audit baseline update; do not claim the remaining 8,516 lines are unused.

**Exit:** no new global CSS, CSS parser and source-owner report in CI, typed components, route/role count checks, frontend emitted CSS, Django and security checks green. Browser evidence remains honestly pending until executed.

## Batch 2 — Admin and Staff feature migration + deletion
**Scope:** **85 Admin + 10 Staff** routes, grouped into bounded PRs:
1. Foundation-heavy, high-volume screens: dashboard, navigation, catalogue/product/plan workbench, details and list grids.
2. Financial/commercial screens: orders, quotes, invoices, transactions, checkout administration, domain management, integrations and settings.
3. Staff service screens: tickets/support, customer operations and role-sensitive actions.

**Implementation per group:** keep data hooks/API endpoints as-is. Replace legacy layout wrappers, table markup and form layout with existing typed design-system components and opt-in spacing variants. Use responsive cards/overflow-safe tables on mobile, keep keyboard row actions and stable dialog/open state. For any custom visual where utilities are insufficient, create `<Feature>.module.css` co-located with its component, with no unscoped style rules. Remove now-unowned selectors from global CSS immediately in the same review. Update selector baseline hash/line count, dependency report, screenshots, contrast/focus and all affected viewports.

**Exit:** 95/95 Admin/Staff route-level visual checks in six widths with representative state/permissions evidence and no backend/financial behavior differences. Check archived or disabled integrations are not represented as ready.

## Batch 3 — Client, Auth/Public, global CSS retirement and release
**Scope:** **33 Client + 7 public/auth** routes and cross-role final regression. Auth includes the approved Console logo, account flows, recoverable validation and no OPanel duplicate login. Client flows include service ownership, published offers/checkout, invoices/payments, domain search, profile, notices and support.

**Implementation per group:** migrate remaining legacy consumers with same-PR selector retirement, and isolate legitimate feature-local styles. Once dependency report, signed viewport evidence and actual computed-style checks show all legacy selectors retired, replace the old global stylesheet with a compact **Tailwind directives + semantic tokens + minimal base rules** file (target about 472 lines or less if suitable, but correctness is the hard criterion). Keep local CSS Module files only for genuine specialized ownership. Update frozen-baseline guard from a hardcoded legacy size to a *zero legacy classes + explicit allowed globals* policy. DO NOT delete the root stylesheet itself: Tailwind requires a stylesheet import.

**Tailwind 4 decision:** after the legacy sheet is retired, separately qualify a v3→v4 codemod/upgrade on a dedicated review branch. Invoice uses Tailwind 4 with CSS-first `@theme`, `@tailwindcss/postcss`, and a changed utility cascade. Upgrading is approved only if real browser support, touch/hover, focus, generated CSS, JSX classes, `@apply` and old safelist replacements qualify; otherwise retain v3 with the same premium UI. Do not mix this upgrade with the global CSS retirement deletion.

**Exit:** signed 135×6=810 authenticated/public viewport evidence with mobile/touch/keyboard, desktop, error/loading/empty and interactive states, no missing routes, source and computed-style parity, stable API/business regression, Django/isolated DB/security checks, verified Vercel deploy of the exact main SHA when service rate limits and permissions permit.

## Evidence and CI commands
- `node frontend/scripts/audit-css-ownership.cjs --json frontend/.next/ui-css-ownership.json --check` (conservative dependency inventory).
- `node frontend/scripts/audit-console-ui.cjs --check` (frozen role routes and CSS blob hash).
- `node frontend/scripts/check-css-retirement-gates.cjs --built` (current pre-retirement safety).
- `node frontend/scripts/browser-parity-qualification.cjs --plan frontend/.next/batch8-browser-qa.json` (plan only; **not** proof).
- `node frontend/scripts/browser-parity-qualification.cjs --verify <signed-report> --evidence-root <artifacts> --public-key <trusted-key> --key-sha256 <fingerprint> --release-sha <exact-sha>` for final evidence structure (independent reviewer still verifies authenticity).

## External reference basis
- Tailwind official v4 upgrade guide, including PostCSS plugin and @tailwind directive changes: https://tailwindcss.com/docs/upgrade-guide
- Next.js CSS guidance (App Router CSS Modules + global CSS build ordering): https://nextjs.org/docs/app/getting-started/css
- MDN CSS cascade layers (unlayered declarations can override layered utilities): https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Introduction
- Octalve Invoice implementation: https://github.com/octalve-core/octalve-invoice
