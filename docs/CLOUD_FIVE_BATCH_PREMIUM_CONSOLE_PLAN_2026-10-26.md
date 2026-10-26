# Octalve Cloud — Five-batch premium Console release

**Decision (26 October 2026):** implement on existing `review/cloud`. No `main` merge until all five batches' automated, isolated database, browser, external-provider and security gates pass. Never convert sandbox payments or fake hosting into Production authority.

| Batch | Feature coverage | Acceptance |
|---|---|---|
| 1 | Saved contact/billing profile, checkout contact prefill, password recovery, verified email, secure mail transport, auto-sync and premium copy | Own-account PATCH + authorization/abuse tests, real provider mail delivery, desktop/mobile |
| 2 | Supplier-backed catalog, domain choice, retail markup/coupons, orders, invoices/PDF, payments, refunds, renewals | One idempotent order/invoice and independent gateway settlement, failure/replay |
| 3 | Authorized vendor provisioning, verified service, DNS/SSL, OPanel PKCE SSO, files, WordPress/static deploy, backup | One real isolated hosting account and HTTPS website with correct content |
| 4 | Admin and Staff work queues, scoped RBAC, tickets, knowledge, settings, notifications, reporting, audit | Per-role business workflows with denied cross-user access |
| 5 | Consistent Invoice-style UI, mobile/accessibility, recovery, observability, migrations, regression matrix, final release | Exact-head CI + browser + external service + release/rollback sign-off |

## Batch 1 delivery and release boundary
- Reuse existing `CustomUser` contact/address fields: no new customer/billing table and no duplicate payment identity.
- Self-owned `GET/PATCH /api/auth/profile/` permits only contact/billing fields; email, roles, tax exemptions, verification and privileges remain immutable from this endpoint.
- Password reset link uses configured public HTTPS Console origin, one-time Django reset token, durable per-email throttle, enumeration-safe responses. It requires explicit trusted mail transport `CLOUD_ACCOUNT_EMAIL_ENABLED=true`, `DEFAULT_FROM_EMAIL` and an approved backend. Never imply the old file-based local email backend delivers messages.
- Email verification is an authenticated request with durable throttling and independently signed expiring email-only token; no activation is automatically assumed. Verification link fragment avoids leaking token to Next.js server access logs. Replay, expiry, password/email change and other-user token fail closed.
- Client checkout reads saved account profile and shows contact details; billing invoice snapshot/checkout invoicing extensions are tracked for Batch 2.
- Refresh buttons are replaced with bounded, visible-tab read-only GET synchronization; manual write retries remain explicitly user initiated.
- **No production-ready claim** without an actual email provider, disposable-DB tests, live browser and clear security review. Feature defaults OFF; Production database and payment/provisioning remain untouched.
