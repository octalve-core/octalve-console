# Octalve Cloud — Client commerce, domains, support and Admin editor UI uplift
**Review base:** `d5e560565c95550af886e167601ac27e3068c78c` (qualified and merged PR #92). This is the next bounded Admin/Client presentation migration, **not 135-route browser sign-off**.

## Migrated actual screen contracts
- `ClientOrderView`: locally scoped `commerceColumns` with two-column-span plan list and real summary on desktop. Preserves `loadSellablePlans`, allowed published catalogue selection, selected cycle, error/outage and no-price fallbacks; zero new checkout authority.
- `ClientCheckoutView`: scoped 3-column layout plus responsive `choiceColumns` domain selector, retaining Domain→Review→Confirmed stages, server quote, validation, payment/order separation, confirmation, consent, and existing API idempotency logic.
- `ClientDomainManagementView`: `domainFacts as="dl"` preserves semantic term/value pairs, two/three responsive columns; `domainPanels` preserves DNS and renewal shortcuts, exact-ID ownership and fail-closed registrar status.
- `ClientSupportTicketEditorView`: scoped `supportColumns` wraps the existing `SupportRequestFields` form and specialist guidance. All department/topic APIs, submit constraints and account-scoped ticket redirect unchanged.
- `HostingPlanCards`: scoped `planCards as="section"` preserves accessible section label, real published prices and cycle labels, selection pressed state, callbacks and features.
- `AdminEditorFields`: scoped `editorFields` preserves responsive 2-column textarea span, exact field names, errors, onChange and existing text/password/select controls.

The shared `WorkspaceGrid` now supports semantic `section` and `dl` output in addition to `div`/`ul`, without moving API/mutation logic into layout primitives.

## CSS owner evidence
- Adds seven locally scoped grid variants **inside the existing** `WorkspaceGrid.module.css`. Does not introduce new global CSS or duplicate Tailwind/PostCSS setup.
- Preserves `globals.css` exactly **8,460 lines, 153,180 bytes, blob `4bade3c74196118a0372adc60f94dcd7fa817ad1`**. Other route components still consume global `.grid` and `.space-y-6`; deleting their definitions now would break unknown states. No selector is falsely marked retired by this PR.
- Keeps the original CSS audit manifest until positive source, computed-style, negative-role and six-width signed browser evidence qualify specific deletions.

## CI and acceptance
- New `frontend/scripts/check-ui-uplift-commercial-domains.cjs` checks preserved API/state/route/selection contracts and compiled scoped CSS, alongside existing source, TypeScript/Next build, Django and security jobs.
- All **135 routes × 6 viewports = 810 browser cases remain unqualified** until real screenshots and interaction evidence under role-correct isolated Review sessions is produced. Do not substitute test manifests for screenshots or make test payments/service provisioning/production credential changes.
- Financial reporting aggregation access patch #86 merged; report export, storage permissions, multi-currency settlement semantics and metric visibility #88 remain blocked. Browser evidence #89 also open.
- No blanket CSS retirement or Tailwind 4 jump. Tailwind v4 major breaking changes and higher browser floor require a separate reviewed upgrade.

## Next source work
Admin/Staff record/detail editors, catalogue workbench, resource directories and operational screens; Client notifications/account/wallet/rewards/renewal states; then zero-consumer and computed-style audit, 810 browser case captures, finance security and exact SHA Vercel Production release. See `docs/CLOUD_UI_INVOICE_GRADE_THREE_BATCH_MIGRATION_2026-10-28.md`.
