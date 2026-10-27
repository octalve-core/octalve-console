# Octalve Cloud — Batch 12: Customer Notifications and O-Cloud Clan
Date: 2026-10-27. Base: `380b8df20ef337ab85ee9baf3bbd99919b784796`.
Release: existing `review/cloud`, SHA-locked CI merge, then both Vercel deployments.

## Implementation
1. **Authoritative live alerts:** `GET /api/notifications/inbox/` computes customer-specific upcoming / past-due invoices and domain expirations directly from the protected Invoice and Domain ORM. Invoices: within 14 days of due or up to 45 days overdue, unpaid/partially_paid/overdue and positive outstanding balance only. Domains: within 35 days before or seven days after expiry, only active-owned records. No fake email notice history and no invoice/payment/domain mutations.
2. **Repeat reminders:** stable per-event, per-due-date-stage keys for 14/7/1 day and overdue invoice windows; approximately month/7/1 day and expired domain windows. Changing from an early to late stage creates a new unread in-app notice; paid invoices or changed dates disappear/re-evaluate dynamically.
3. **Atomic owner-scoped read state:** `POST /api/notifications/read/` verifies a supplied notification key belongs to the signed-in client, then persists bounded read keys to existing `CustomUser.metadata.console_notices_v1` inside a row lock and transaction. Reading a notice does not settle an invoice, change the domain or contact a registrar.
4. **Preferences:** authenticated `GET/PATCH /api/notifications/preferences/` stores strictly boolean settings for displaying on-login dashboard reminders and for invoice/domain banner selection. The full account inbox remains available despite preferences. Preferences are never treated as disabling legally mandated registrar communications. No new migrations.
5. **Frontend:** Client dashboard on-login alert; dedicated `/client/notifications` inbox with unread count, refresh, link to exact invoice/domain renewal and mark-as-read. Header notification icon is visible only for clients; Client sidebar Notifications item. Settings houses notification preferences, leaving Language inside Settings.
6. **O-Cloud Clan:** dedicated `/client/community` page. `GET /api/notifications/community/` reads only Admin-configured **public, nonencrypted, active** general Settings keys `ocloud_whatsapp_channel` and `ocloud_telegram_channel`. Links must pass HTTPS hostname+path allowlists (`whatsapp.com/channel/...` and `t.me/...`); no user-supplied redirect, default fabricated groups or automatic enrollment. If absent, display "Coming soon"; contacts/links must be approved by Admin.
7. **Security:** BFF allowlisted notifications root still requires HttpOnly-authenticated Django identity; Django denies staff/anonymous roles for these customer APIs. TypeScript/Tailwind pages validate account-scoped data and expose no arbitrary URLs. No payments, external email sends or external platform enrollment.
8. **Tests:** Django isolates two customers, scoped invoices/domains, paid invoice withdrawal, idempotent read marking, false/unknown preference rejection, settings link allowlisting and staff/anonymous denials. CI adds Batch 12 frontend routing/data contract guard.

## External notice compliance / standards
ICANN Expired Registration Recovery Policy updated 21 February 2024 (implemented no later than 21 August 2025):
https://www.icann.org/en/contracted-parties/consensus-policies/expired-registration-recovery-policy/expired-registration-recovery-policy-21-02-2024-en

The registrar—not this Console in-app inbox—must transmit applicable gTLD notices approximately a month and a week before expiration, and qualifying post-expiration notices. Required delivery cannot depend on login. Actual registrar email compliance and signed delivery receipts belong to the certified registrar/provider onboarding phase.

## Explicit Phase 4 / future implementation gates
- No email/SMS or push delivery is enabled. Actual delivery requires a durable purpose-built outbox, validated verified recipient, template content/versioning, consent & unsubscribe where applicable, idempotent job key, verified provider secret, retry/backoff, bounce reporting, audit, rate limiting and suppression. Before switching on, connect deployment scheduler/worker and prove exactly-once user-level effects under concurrency and source changes. The unrelated existing HostingNotice outbox is **not** evidence that billing/domain notices were sent.
- In-app notices are computed from actual records, not a historical notification event ledger. Read markers persist in bounded user JSON to avoid a new Production migration. When eventually migrating to a normalized per-event ledger, build idempotent backfill and preflight migration with the consolidated operator PowerShell workflow. Avoid introducing a schema migration into this batch.
- Community channel Settings must be explicitly populated and approved by Admin. Do not assert a group exists until links are verified.
- Customer account settings remain English-only; Batch 14 contains real i18n.
- No genuine DNS, registrar, OPanel, automatic renewals or settlement operations were activated.

## Testing and deployment
- Exact-head TypeScript, Next.js, frontend regression, isolated Django and disposable PostgreSQL CI before merge.
- New `/client/notifications` and `/client/community` add 2 Client routes; 130 → **132 Console routes**, 30 → **32 Client routes**. Signed six-viewport parity now **792 cases**; static inventory tests do not constitute browser evidence. Legacy global CSS remains until qualified.
- After deployment, verify authenticated client dashboard, two different accounts, a synthetic soon-due invoice and domain, mark-read persistence after refresh, paid invoice disappearing, Settings retention, and links staying hidden until Admin config.
