# Console design-system primitives (Batch 1)
The components here use **TypeScript + Tailwind CSS v3 + Lucide React**, with no added CSS files and no APIs.

Use explicit static class maps from `action-styles.ts`, the `console.*` Tailwind colour tokens, and existing `cn` utility. Keep variants and sizes as typed unions. The new components are **additive**; existing pages are migrated only in later approved batches.

- `ActionButton` and `ActionLink` keep actions and navigation distinct. Neither initiates remote work without a supplied handler/link.
- `TextField`, `SelectField` and `TextAreaField` use labelled native controls, generated IDs, aria-describedby/aria-invalid, 48px default height on one-line controls and visible errors.
- `ConfirmDialog` is native `dialog.showModal` with explicit cancel/confirm callbacks; callers must own mutation authorization, loading and errors.
- `ResponsiveTable<Row>` uses native semantic table elements on desktop and labelled stacked cards on mobile. Row identity is required, no index key.
- `Panel`, `SectionHeading`, `EmptyState`, and `StatusBadge` establish reusable layout/feedback patterns.

Backend operations, access control and money/provisioning verification remain in Django. New UI components must never simulate server success.

CI: `node frontend/scripts/check-console-design-system.cjs`, `node frontend/scripts/check-console-design-system.cjs --built` after `pnpm build:frontend`, and the Batch 0 baseline audit.
