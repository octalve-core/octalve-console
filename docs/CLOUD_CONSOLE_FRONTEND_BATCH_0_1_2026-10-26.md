# Octalve Console — Batches 0 + 1: frontend audit and design-system foundation
**Baseline:** 26 October 2026, Console commit `7bfaafc340f9fa274050006c2cae90aa3d7d07d9`. **Scope:** frontend-only; no Backend, payment, provider, DB or SSO changes.

## Batch 0: verifiable snapshot
- 116 Client/Staff/Admin `page.tsx` routes (23 Client, 10 Staff, 83 Admin). See `frontend/audits/console-ui-baseline-2026-10-26.json` for every route.
- `frontend/src/app/globals.css`: 8526 lines, 155849 UTF-8 bytes, Git blob `e1ab22169d6947fad243f8bde9e989c709fbecbd`. Retained unchanged. `frontend/src/features/auth/components/AuthLayout.module.css` is a separate pre-existing scoped CSS module.
- Existing shared UI primitives are mixed with legacy class-name styling and role-specific views. Existing app routing and Django API authority must not be rewritten during styling work.
- Run `node frontend/scripts/audit-console-ui.cjs --check` in CI to guard missing role routes, unintended changes to legacy CSS and unexpected additional CSS files. Later approved migration batches may deliberately update this snapshot with written rationale.
- Do not confuse green CI with cross-role browser acceptance or provider/financial production qualification.

## Batch 1: new additive design system
- New reusable `frontend/src/components/design-system/` primitives (buttons, fields, panel, header, badge, table, confirmation, empty state, Lucide icons).
- Strictly typed props, static Tailwind v3 utility maps, 48px default interactive controls, proper accessible labels and descriptions, responsive mobile tables and no additional stylesheet.
- Do not replace old components automatically or remove CSS before Batches 2–8 have proven page-by-page compatibility.
- **Audited configuration issue:** Legacy `frontend/tailwind.config.js` is currently the active Tailwind configuration and `frontend/tailwind.config.ts` is also present. Batch 1 synchronizes only the new brand tokens/safelist in both; do not delete the active JS file or broaden its content scan until Batch 2 browser/style parity checks. The CI design-system guard detects token drift. Full TypeScript-only config consolidation is a planned later migration gate. The new component library is a stable contract for future migration.

## Subsequent Batches 2–8
1. Migrate one page family at a time to thin routes and `features/<domain>/components`, `views`, `hooks`, `types`.
2. Keep Backend endpoints, payment and provisioning authority, RBAC/tenancy checks, user-visible production copy, navigation and route URLs unchanged unless separately authorized.
3. Inspect and retire only CSS selectors no longer used; update snapshot deliberately. Avoid dynamic Tailwind class fragments and forbidden broad CSS overrides.
4. Validate TypeScript, production build, emitted CSS, authenticated desktop and mobile flows at 320/360/390/768/1024/1440, keyboard and contrast, plus prior Django/security/PostgreSQL tests.
5. Release from `review/cloud` via exact-SHA PR checks, merge into `main`, verify Console/API Vercel aliases. Keep live registrar/payment/provider writes OFF until their independent gates.

## Source references
- https://nextjs.org/docs/app/getting-started/css
- https://v3.tailwindcss.com/docs/content-configuration
- https://react.dev/reference/react/useId
- https://lucide.dev/guide/react/
