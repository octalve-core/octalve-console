# Octalve Console — Premium UI foundation & safe CSS retirement
**Review date:** 2026-10-28
**Baseline:** main 462ebe56c4afd3363a430e2f11f631c1b10537e6 (Batch E)
**Authority:** Frontend design only. Preserve Django, SSO, domain, invoice, catalogue, payment and provisioning authority.

## Findings grounded in current source
- Console uses Next.js 16, React 19, TypeScript, Tailwind **v3.4**, `frontend/tailwind.config.ts`, and a large `src/app/globals.css`.
- Before this patch, `globals.css` contained **8,526 lines** (~156 KB stored blob), with 510 distinct regex-detected class selector tokens. This is a lexical inventory, **not** proof each is required or unused.
- Global rules such as `.grid`, `.table`, `.card`, `.button`, and `.page-container` can override Tailwind styling because the stylesheet places global rules after the Tailwind directives. The same selectors occur at different points and across breakpoint rules. Do **not** delete them without source dependency audits, computed-style evidence and authenticated screenshots.
- `frontend/postcss.config.js` and `postcss.config.mjs` contained equivalent Tailwind v3 + Autoprefixer plugin setup; retaining both is redundant. This patch keeps the canonical `.mjs`.
- An exactly duplicated `.error-alert` rule appeared at original lines 560 and 787, with the same declarations. Removed only the earlier identical copy, leaving the later one intact. Protected stylesheet now has **8,516 lines**. This is **not** broad CSS retirement.
- Existing TSX components already include DashboardShell, design-system Panel, SectionHeading, ActionButton, ResponsiveTable, and role-aware navigation. Do not replace them with a new scaffold.

## Reference comparison
| Source | Framework | Styling architecture | Applicability |
| --- | --- | --- | --- |
| `octalve-core/octalve-console` | Next.js/React | Tailwind v3 + 8,526-line compatibility sheet before this patch | Preserve existing flows; consolidate gradually |
| `octalve-core/octalve-fintech` | **Expo/React Native**, NOT Next.js | NativeWind v4 with Tailwind v3; three Tailwind directives in mobile global.css, color/layout tokens in `apps/mobile/src/design/tokens.ts` | Reuse modular design-token philosophy, not mobile JSX/native architecture |
| `octalve-core/coov-web` | Next.js 16 web | Tailwind v4, relatively small globals.css, typed Container/Section/Heading components | Better reference for web layout rhythm; do not import its purple fintech branding |

No accessible `octalve-core/octalve-finance` repository was found. Do not claim its implementation was examined; the two closest confirmed repositories above were inspected.

## Approved design principles
1. Console blue/ink/white branding remains authoritative. Neither COOV plum/gold nor other product branding should bleed into Console.
2. Tailwind v3 is retained for this controlled foundation batch. A future v4 upgrade, if chosen, must be an independently qualified migration (build tooling, @theme, CSS directives, lockfile and screenshots).
3. Use the Tailwind spacing scale; `rem` for fluid type and proportional spacing, CSS `clamp()` for bounded responsive gutters. `px` remains valid for borders, icons, media assets and fixed dimensions where justified; absolute units are not inherently incorrect.
4. On dashboard pages prefer a constrained, readable content width, responsive page gutters, 1.5rem card radius, 0.875rem controls, and consistent typography. Marketing sections may use larger padding than dense admin workspaces. **Do not force `py-32` on order tables or edit forms.**
5. Existing shadcn-like primitives already exist. Consider individual accessible Radix/shadcn patterns only after checking component contracts; do not run `shadcn init` wholesale or replace existing components.
6. Prefer meaningful spacing between groups, not extra empty whitespace around every label. Avoid broad custom selector overrides and `!important`.
7. Accessibility: preserve focus visibility, touch targets, semantic labels, reduced-motion behavior, and 320px layout with no unexpected horizontal overflow.

## Safe code delivered (source-level, not deployment)
- Removed redundant CommonJS PostCSS config; `postcss.config.mjs` remains the Tailwind v3/Autoprefixer source.
- Removed **one** exact CSS duplicate; the compatibility stylesheet and root import remain.
- Added nonbreaking opt-in Tailwind tokens: `page-gutter`, `section`, `section-lg`, `console-content`, `console-reading`, `console-card`, `console-control`.
- Added typed `WorkspaceContainer` and `WorkspaceSection` primitives for future **per-screen** migration; no forced shell or route rewrites.
- Strengthened CSS retirement checks, with an additional built-CSS guard and CI job. Existing 135-route source guard remains intact.

## Qualification before any further CSS deletion
1. **Inventory:** extract CSS declarations with a parser, not regex alone. Trace static and conditional `className`, component variants, CSS-in-JS, dynamic imports, pseudo-classes, media rules, accessibility states, portals, fallback views, error screens and print styles.
2. **Migrate:** choose an independent route/module; replace its known legacy selectors with typed reusable Tailwind primitives; preserve JSX, data/API, callbacks, permissions, error states and form values.
3. **Compare:** build pre/post under the same Node/pnpm lockfile and environment; compare emitted CSS and all route bundle warnings. Add computed-style tests for collision-prone selectors (`.grid`, `.table`, `.card`, `.button`, etc.) and test keyboard/touch behavior.
4. **Browser evidence:** use authentic Admin, Client, Staff, public and auth sessions. Capture signed evidence for **135 routes × six widths (320, 360, 390, 768, 1024, 1440) = 810 cases**, including dynamic IDs, loading/empty/error states, tables, dialogs, forms, navigation and real permission denial.
5. **Delete:** remove a selector only when zero consumers AND visual/accessibility parity are established. Keep PR changes bounded to one module/selector family; update checked manifest, screenshot evidence and gates.
6. **Release:** merge only passing qualified PRs. Vercel builds may be rate-limited and cannot be interpreted as green deployment. Verify exact deployment SHA, production URLs, source maps/errors and preserve rollback capability. No live provider/financial activation.

## Next suggested batches
- **UI-F2:** Source CSS AST/selector ownership report, emitted CSS mapping, collision ledger and baseline screenshot harness; no style deletion.
- **UI-F3:** Migrate low-risk, high-visibility shared surfaces: page header/card/form shell, first Admin and Client representative screens, compare at six widths before expanding.
- **UI-F4:** Authenticated browser parity for remaining routes and legacy CSS retirement per qualified group. Only then allow removing `globals.css` legacy blocks or splitting a minimal `globals.css` with tokens/base.
- **UI-F5:** Optional scoped shadcn/Radix components (tabs, dialogs, select) after functional and accessible regression, with tests and variant contract, without re-implementing business logic.

**Explicit non-certification:** This PR does not claim an authenticated visual audit, zero legacy CSS consumers, live supplier validation, production DB access, or deployed Vercel status.
