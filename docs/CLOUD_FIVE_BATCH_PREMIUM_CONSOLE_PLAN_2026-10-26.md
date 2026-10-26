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

## Batch 2 Review implementation — commercial order flow
- Customer journey: select supplier-qualified plan and cycle, choose owned domain or connect later; new registrar sale is locked pending external fulfillment evidence.
- Server-authoritative read-only quote and promotional verification; final order independently prices again, pins a server-owned billing snapshot, and creates one unpaid invoice by checkout ID.
- Invoice PDF download uses reportlab and account-scoped API permissions; no unpaid invoice is portrayed as a paid receipt.
- Read-only gateway readiness excludes unapproved integrations; pending invoice status checks stop after 15 observations, never initiate payment automatically.
- Idle list synchronization: no background polling. Load on navigation; recheck on focus after 2 minutes. Only processing status screen uses temporary bounded polling.
- Octalve blue, softer medium text, minimal cards and mobile-first progression influenced by Namecheap flow and Octalve Vault spacing, without copying their assets or asserting unavailable promotions.
- **Unqualified gates:** live domain search and resale, gateway collection, signed policies, transactional emails, real hosting provisioning and live website proof. Keep Production unchanged.


## Batch 3 — Console boundary coordinated with independent OPanel

- Live OPanel PR #1 remained a draft at `2eb12488fadfeb07636eefad91097294e918ddb0` at the check, with one active OPanel development branch. Do **not** modify or merge the independent OPanel working tree from Console.
- OPanel Work's native filesystem, preview upload, WordPress eligibility and DNS connector prototypes are tests/contracts only. Without a qualified host, the OPanel capability issuer must continue to grant only `overview`. Do not silently change OPanel API schema.
- Console's customer hosting-status API uses an exact owner-only lookup; Staff and Admin have their own authorized screens and cannot borrow a customer launch page to enumerate service IDs.
- A new additive `readiness` object distinguishes verified hosting account, eligible OPanel access, unavailable files, unverified DNS, unverified TLS, and unverified public website. The existing v1 `exchange` and `entitlement` contract is deliberately unchanged.
- Customer hosting status uses Invoice-inspired spacing and Octalve blue with honest resource timestamps, no synthetic online checkmark, and no repeat idle polling. Existing Console permissions, billing/payment authority and real provider credentials are unchanged.
- **Launch blocks:** actual isolation on Review deployments, provider inventory/account readback, one authorized real service and website publish, DNS/HTTPS public evidence, verified site HTTP body, service expiry/suspension, and cross-repo exact SHA pinned CI. No forced migration, VPS purchase, Production deploy or OPanel merge.

## Batch 4 — help centre, queue routing and staff support operations

- Customer-facing support uses real active department choices, optional topic tags within each department, statusful ticket conversation and honest secure attachment limitations.
- New SupportRoutingTag records are admin-managed per department. Admin assigns staff membership to a department before its topic(s). Tickets route to the least-busy eligible active staff member, or remain unassigned in the relevant team queue. No unrelated fallback, cross-customer assignment or implied email broadcast.
- Admin and Staff ticket workspaces use real scoped API records. Staff cannot mutate another assignee's ticket or browse unrelated departments. Admin alone manages assignment and priority; clients cannot forge role/status/internal notes.
- Support messages and last-message previews exclude internal notes for customers. Ticket related service/order/invoice IDs are verified against the customer.
- Customer knowledge base loads published client-visible articles from the Django endpoint, with responsive search, topic filters and readable article pages. Admin/Staff can draft/edit with a controlled Markdown formatting toolbar and preview; Staff publication requires explicit Django permission. Raw HTML is never inserted into the customer article view.
- **New isolated migrations only**: support.0002_routing_tags and knowledge_base.0001_initial, both included in the disposable Review CI ledger. Existing 49-migration baseline retained, with expected total 54 migrations / 99 tables.
- Notification attempts run after DB commit; external delivery/availability/SLA must be qualified separately. Real-time chat and public unauthenticated support are deferred. No Production migrations or main merge.
