# Octalve Cloud — SEC-01 + BIZ-01 browser acceptance gate (2026-10-25)

**Gate:** BLOCKED — an authenticated Vercel project lookup for both `octalve-console` and `octalve-cloud-api` under `octalve-vault` returned 404, so no verified Review deployment was available from this connector. Do not claim browser acceptance or Production release.

## Qualified immutable source checkpoint
- Latest reviewed source: `700c63c42265b9999205718b9553921e173498fc` (remove all operational fallback/demo data).
- GitHub Actions C1 run `40165211171` = SUCCESS, disposable PostgreSQL run `40165211137` = SUCCESS.
- Git `frontend/vercel.json` and `backend/vercel.json`: `review/cloud: false`, `main: true`; this permits CI-only Review development, but deployments must be deliberately arranged and exact branch-scoped Preview variables checked.
- Previous SEC-01 Review database verification: isolated Neon `octalve_sec01_review` contains 49 migration rows and 92 public tables, Production remained at 48/91 when last verified. Re-read before release.
- No deployment or main merge authorized **without passing the live gates below**.

## Reproducible browser walkthrough (each role as authorized)
1. Resolve actual Vercel project ownership/team and verify a **single** API and a **single** frontend Review deployment both target the exact source SHA and Review-only Neon credentials. Never guess branch aliases or use detached CLI deployments with uncertain Preview variable scope.
2. Use synthetic user credentials and the actual deployed home URL as the only browser entry navigation. Click visible Login; verify role-specific dashboard, sidebar, search, forms and menu links. Do not `goto` internal pages in the acceptance evidence.
3. Record full viewport screen/video for desktop `1440×900`, tablet `768×1024`, mobile `390×844`. Assert no horizontal page overflow, clipped controls or oversized table on mobile. Check keyboard navigation and action-sheet close/cancel/focus return.
4. Client: click **Buy service** → select plan → choose billing cycle → click Continue → type optional project/domain → click Create order → assert actual server-generated order number and unpaid invoice (not a simulated toast) → click View invoices → navigate to the correct invoice by UI links → compare currency, amount, due date and client isolation.
5. Retry the exact checkout key and assert one order, one invoice, no duplicated charges. Invalid/hidden plan, invalid cycle and another client's documents must be denied.
6. Auth: signup/login/logout, refresh preserving a session, expired access token, concurrent refresh, forged or missing Origin/CSRF, throttling `429`, staff/admin/client authorization and signed-out protection.
7. Admin and Staff: visit record pages only by navbar/links; inspect status badges, table filters, search, mobile cards and action sheets. No backend record may be represented by fallback/demo fixtures.
8. Verify actual API origin, exact Review database identity, migration schema and dashboard access; do not use Production datasets in Review.
9. Capture screenshots/video/steps with sensitive tokens, emails and test credentials redacted; keep evidence private and document failures by reproducible clicks, expected vs observed behavior.
10. Fix confirmed defects, rerun CI, then do another deliberate single-project deployment only if affected; do not spend deploys on ordinary commits.

## Production gate
- SEC-01 browser acceptance must be completed; current passing unit/integration CI is not enough.
- Audit and apply Production migration 49 under the separate approved incremental migration/rollback process.
- Qualified BIZ-01 checkout must create an unpaid invoice without collecting money or provisioning a service.
- Payment verification, service provisioning, domain/email/hosting offerings and commercial go-live have their own additional acceptance gates; do not claim the platform ready for paid service delivery before they pass.
- Approved merge only after verified acceptance and exact commit/rollback plan. A blind `main` push is prohibited.
