# Octalve Console — Batch 6 Staff Console (2026-10-27)

Verified parent merge: `e4415d9c0e60edf46872a6781cc8a42791fd3df9` (Batch 5).

## Completed
- `StaffOverviewMetrics`: typed, accessible five-metric responsive grid preserving original `Promise.allSettled` source, null-is-unavailable semantics and actual authorization-dependent counts. Loading and unavailable items do not become fake zeros.
- `StaffQuickActions`: actual Staff role destinations for Tickets, Provisioning, Knowledge Base and Orders using Panel, TypeScript and Lucide.
- `StaffRecentPanel`: presentation of actual recent tickets/provisioning items; loading/unavailable truth retained.
- `StaffOperationalDirectory`: responsive mobile cards/semantic table for Customers, Orders and Provisioning. Client-side search/status filtering and ten-row pagination over fetched authorized rows; no attempted updates, settlements or provisioning actions.
- `StaffSecurityOverview`: accessible explanation of role-scoped access and server-owned security; removes hard-coded claims of a specific token technology or live audit/MFA controls. Staff does not gain Admin permissions.
- Preserve `StaffResourceListView` loaders, `normalizeStaffRecord`, existing `useAutoSync`, Staff route assignments and existing Batch 5 API-backed ticket and knowledge article views. Explicit Staff detail actions are not introduced because Staff Customers, Orders and Provisioning have no verified dedicated detail/action routes in this release.
- Add the narrowly scoped Staff feature glob to both Tailwind configuration files so production CSS contains the new component utilities, with no change to `globals.css`.

## Backend boundaries / post-Batch-8 backlog
- Customer listing loader currently calls `adminApi.customers()`; a potential role-permission mismatch must be checked in an authenticated Staff session before considering any backend contract change.
- Dedicated provisioning action flows, individual Staff order/customer details, historical security activity and new permission controls require verified backend API and authorization review. Do not imply that merely drawing action buttons makes them functional.
- No changes to Django, API paths, SSO, RBAC, migrations, invoice/payment authority, hosting activation, provider adapters, dependencies or global CSS.

## Acceptance
Batch 0–6 tests, TypeScript/Next production build, compiled CSS regression, security and isolated Django routing/knowledge/provisioning tests and disposable PostgreSQL must all pass on exact review commit. Merge to `main` only when every critical gate passes and check READY Console and API aliases against the merge SHA. Authenticated browser verification for Client/Staff/Admin remains separately required, including 320/360/390/768/1024/1440px views. No real provisioning/payment action is part of this frontend-only batch.
