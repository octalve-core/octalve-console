# Octalve Console — Batch 8: CSS audit, consolidation and release qualification
Date: 27 October 2026. Starting main: `50c55629a28964a713772ba7d9a20cd215dcaa12`.

## Scope and protected rules

This is the front-end-only final migration phase. Django API, authentication, RBAC, SSO, provider control, domain/DNS/SSL, payment authority and hosting provisioning cannot change in this batch. The frontend must use TypeScript, Tailwind CSS and Lucide with section components. Production wording must never claim that demo records or inactive actions are operational.

## Baseline static audit — evidence from GitHub Actions

- **123 page routes:** Admin 83, Client 23, Staff 10, Public/Auth 7.
- **362 source TS/TSX/JS/JSX files**, one stylesheet: `frontend/src/app/globals.css`.
- **8,526 lines** and **155,849 UTF-8 bytes** in legacy CSS.
- Conservative selector scan recognized 510 possible CSS class names. This overcounts some selector fragments, media contexts and Tailwind-compatible selectors; it is not a browser-style measurement.
- Direct JSX class-attribute audit on the baseline reported **92 source files** with candidate class collisions and **117 page routes** connected to such files through their static import graph. This is a deliberately conservative **dependency inventory**, not a proof that 117 routes rely on legacy styling. Names like `grid` and `space-y-6` also exist in Tailwind. Dynamic class builders and runtime states still need independent inspection.
- Significant legacy rule groups still exist for `page-container`, `premium-table`, `checkout-v2-*`, `domain-search-v2`, `oct-topbar`, `sidebar`, `auth-*` and other domain/payment UI patterns.

## Work safely completed on Review

- Consolidated duplicate `tailwind.config.js` and `tailwind.config.ts` into **one canonical TypeScript config** (`frontend/tailwind.config.ts`) retaining the full src scan, Octalve brand colors, shadow token and safelist; updated previous Batch 0–7 regression checks accordingly.
- Added `frontend/scripts/audit-legacy-css.cjs` to map route imports and candidate CSS consumers. Run with `--json <path>` for detailed file/route results; `--require-retired` intentionally fails while the stylesheet is not ready to remove.
- Converted shared `PageHeader` to Tailwind-only responsive markup.
- Converted three standalone Admin Affiliates routes to a reusable, role-guarded Tailwind/Lucide section that does **not** invent affiliate accounts, commissions, editing or customer data.
- Added `frontend/scripts/check-css-retirement-gates.cjs`, requiring single TS Tailwind config, all 123 routes, unmodified compatibility CSS and compiled CSS selectors.

## Blockers before genuine global CSS retirement

1. Eliminate all **actual** legacy-only CSS usages in rendered routes/components, including conditional styles, forms, shared table components, checkout, domain search, auth and specialized admin tools.
2. Review CSS cascade overrides of overlapping Tailwind utilities (`.grid`, `.space-y-6`) and preserve intended layouts without unintended global side effects.
3. Confirm all 123 routes at **320, 360, 390, 768, 1024 and 1440px**, with authenticated Client, Staff and Admin sessions where applicable. Check keyboard, scrolling, menus, forms, dialogs, row actions, edit/navigation flows and focus states. Static CI does not establish visual parity.
4. Test actual server-verified permission boundaries and read-only payment/provider workflows; avoid collecting real money, sending external messages or provisioning hosting merely for visual QA.
5. After zero dependencies and approved visual parity, replace `globals.css` with only minimal unavoidable reset/base CSS and consolidate the entry point. Update the safety gate and rerun all CI plus both Vercel Production confirmations.

**Release decision:** CSS deletion is NOT currently qualified. No unconditional removal, no assertion that every specialized page has been rebuilt. This preserves Production until the remaining high-risk UI is actually verified.

## Exact-release gates

- Node/TypeScript/Next production build.
- Batch 0–7 source and compiled Tailwind checks plus Batch 8 static CSS inventory and guard.
- Existing Django and security tests, disposable PostgreSQL acceptance.
- PR-review/merge SHA, both Production aliases READY and matched to merge SHA.
- Authenticated browser parity remains outstanding independently of CI; record evidence before declaring Batch 8 complete.

## Continuation — shared login logo and legacy UI components

- Authentication screens now reuse the exact approved dashboard `CloudBrandLogo` component, with the same `/branding/octalve-cloud-logo.png` asset, fallback, and dedicated auth padding/size variant.
- `DataTable` now renders responsive mobile cards and semantic desktop tables without legacy `card/table/actions` selectors. Existing record action links and status colors are preserved.
- Shared `FormField` now uses Tailwind for labelled inputs, selects and textareas, retaining existing value/defaultValue and handler contracts.
- `AdminPremiumTable` and `PremiumStatusPill` now use Tailwind and Lucide. Filtering, status, mobile/desktop row actions and existing caller-supplied handlers remain.
- CI requires logo identity and source/built CSS regressions via `check-batch8-shared-migration.cjs`.
- CSS deletion remains **blocked**: other checkout, domain, legacy specialist Admin, and global shell selectors need route-by-route work, plus authenticated browser acceptance for 123 routes.

## Browser QA manifest and release blocker

- `frontend/scripts/browser-parity-qualification.cjs --plan frontend/.next/batch8-browser-qa.json` builds a reproducible 123-route x 6-viewport plan (738 cases), including signed-in role and dynamic-ID fixtures.
- `--verify <signed-results.json>` rejects incomplete coverage, absent evidence, missing keyboard/navigation/overflow and data-truthfulness checks, and any dynamic route without verified fixture ID. It is **not** run as a passing CI gate until authentic browser evidence exists; CI generates the plan, never fabricates screenshots or passes.
- Real browser acceptance requires credentialed Client, Staff and Admin test sessions with authorized read-only fixtures; payment/provisioning mutations are out of scope for visual checks. Current status **PENDING**.

## Continuation — live Admin integration safety, 27 October 2026

- Discovered that the Paystack page still mounted an old `ResourceEditor` whose Save button had **no submit handler**. Replaced it with a typed, read-only API-backed gateway record overview through the existing `schemaApi.payments.gateways()` endpoint. Status means **record status**, never payment/webhook verification; no secrets are displayed. No payment or provider write operation was added.
- Discovered that `AdminWorkspaceEditorView` showed a fake Save success after a timeout for Staff, Quotes, Transactions and Billing Services. Removed the unconnected forms and replaced them with a clear read-only unavailability section; `AdminWorkspaceView` no longer promotes unsupported Create actions. Backend mutation endpoints must be explicitly verified before restoring these operations.
- Discovered that `AdminResourceEditorView` could prefill fallback/sample data when an edit record was absent or API read failed, risking modification of a different record. It now requires an exact authorized record and blocks both the form and write on failure. Existing valid `saveAdminResourceRecord` operations remain intact.
- Gateway secret, webhook-secret, API-key and provider-secret fields now use password inputs with password-appropriate autocomplete. Backend storage/response security is **not** certified by a frontend change.
- Added release regression `frontend/scripts/check-admin-integration-safety.cjs` for the above invariants. All Django services/migrations/contracts remain untouched.

### Still pending

- Authenticated role-correct browser verification across 123 routes and six breakpoints.
- Remaining legacy CSS consumers in specialized forms, checkout and domain UI, plus visual styling parity. The legacy stylesheet remains protected.
- Real staff/workspace creation endpoint contracts, full payments gateway secret handling and provider sandbox acceptance require separate backend verification after the frontend qualification, never inferred from mock form input.
