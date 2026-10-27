# Octalve Cloud — Admin Integration & Billing Completion Roadmap
Date: 27 October 2026. Baseline: main cb40b0da9e587d24d2cf52a0d6740154c19f4ad4.

## Verified baseline and scope
- Production Console and API were READY on Batch 13 commit. User confirmed guarded Production Neon rewards migration: 55 migration ledger entries and 107 tables. This is NOT live rewards acceptance.
- Legacy CSS retirement blocked by authenticated visual evidence; 134 routes, 6 viewports, 804 planned cases, not executed/qualified. These counts must update when routes change.
- Admin workspace registry has 14 sections: Billing navigation, two API-backed list views (Services and Transactions), eleven unconnected Admin screens.
- Django already has Invoice, InvoiceItem, Tax and Quote models; persisted invoice number, PDF endpoint and owner filter. Do not duplicate these with a second billing database.
- Existing invoice PDF is plain unbranded ReportLab; user wants official logo and issuer/recipient/line/tax/date/paid/due breakdown. Existing source official PNG: frontend/public/branding/octalve-cloud-logo.png.
- Critical discovery: legacy QuoteViewSet accepted caller-supplied prices and Quote.convert_to_order copied those items without authoritative re-quotation. Quote create/update/delete/accept have been disabled on Review until guarded flows exist.
- Critical discovery: invoice GET serialization used is_overdue() which modified invoice status during a read; Review change makes this calculation read-only.
- InvoiceViewSet Admin financial mutations require further review before exposing through designer or batch operations.

## External comparison (verified sources)
- WHMCS custom PDF/logo/templates: https://docs.whmcs.com/9-1/billing-and-invoicing/custom-pdf-invoices/
- WHMCS next-due-date and duplicate prevention: https://docs.whmcs.com/9-1/billing-and-invoicing/billing-logic/
- WHMCS cron/automation: https://docs.whmcs.com/8-12/system/automation/automation-settings/
- Hostinger customer payment history/PDFs: https://www.hostinger.com/support/5401907-how-to-download-invoices-for-hostinger-purchases/
- Blesta automation, recurring invoicing and provision: https://blesta.com/features/billing/
- Nigerian NRS staged e-invoicing: https://einvoice.nrs.gov.ng/merchant-buyer-solution-portal
- Nigerian FIRS large taxpayer August 2025 notice (not a universal compliance threshold): https://www.firs.gov.ng/pdf/FIRS_adv.pdf
- Nigeria e-invoicing verification/IRN guideline: https://mbs.gov.ng/documents/NATIONAL-REGULATORY-GUIDELINE-FOR-ELECTRONIC-INVOICING-IN-NIGERIA-2025.pdf

## Best target architecture
One Octalve-controlled Django Invoice ledger and immutable server document snapshots for all Console consumers. Client and Admin share the same authorization-checked invoice record, exact document number, legal issuer, monetary figures, linked payment and refund events. Never turn a browser template, invoice status string, screenshot, or a plain PDF into proof of a verified payment. Separately classify ESTIMATE, INVOICE, RECEIPT, CREDIT NOTE, and regulated E-INVOICE. Capture and verify registered legal name, address, RC and TIN/VAT (if applicable), tax treatment, fiscal eligibility, and government reference; do not invent registration, IRN, QR signature or e-invoice certification.

## Approved release sequence

### Batch 13.1 — Immediate invoice PDF foundation and quote exploit closure [REVIEW IMPLEMENTATION]
- Preserve the existing models and owner-scoped PDF route; bundle EXACT frontend approved PNG as a local server asset, add branded multi-page A4 invoice with line items, totals, status and paginated footer.
- Fail closed on more than 200 invoice items rather than silently truncate financial records. No unreviewed file uploads, external fonts, remote image fetches or HTML markup in PDF. No DB schema changes.
- Freeze legacy quote creation, editing, deletion, acceptance until server-owned pricing and reviewed state transitions exist; preserve owner-scoped read. Remove database writes from invoice GET.
- Add isolated tests for branding, owner isolation, PDF limit, overdue read and rejected quote writes; make part of CI. Review SHA must pass exact-head CI before merging. Production unchanged meanwhile.

### Batch 13.2 — Rewards Production acceptance and financial qualification [P0]
- Verify real Production feature toggle, API/Console health, owner and Admin permissions. Keep REWARDS_API_ENABLED false until acceptance is signed.
- On disposable DB test one invoice/one award under concurrency, tenant isolation, verified live-settlement requirement, refunds and append-only reversals.
- Before money: immutable supplier costs, currency/fees/tax, <=5% eligible pretax discount, <=NGN 2,500 cap, >=20% preserved net contribution, promotion stacking rules, redemption reservation, KYC/tax as applicable, fraud/budget monitoring and auditable commission payout. Redemption and payout remain OFF separately.

### Batch 14 — Real multilingual system [P1]
- English fallback, server-stored locale preferences, internationalized Next.js and Django messages, accessibility, pluralization, dates/currency numbers. Arabic RTL only with verified components. Invoice legal language reviewed separately; do not silently translate financial meaning.

### Batch 15 — Authenticated browser and CSS retirement qualification [P1]
- 134 routes x 6 breakpoints = 804 signed role-correct checks today. Real tenant-authorized fixture IDs, keyboard focus, navigation, responsive layout, data truthfulness, payment and provider fail-closed checks; no fabricated browser evidence.
- Retire 8526-line legacy stylesheet ONLY once last dependencies migrate to typed Tailwind, tests and screenshots verify parity. Update route matrix as new pages are added.

### Batch 16 — Invoice Studio, Quotes, Print Queue [P0/P1]
- Branded invoice designer: constrained server-managed template schema, versioned drafts, role approval, legal issuer identity, live preview using synthetic data, immutable issuer/profile snapshots for issued documents, customer PDF parity and controlled history/reprints.
- Quote workflow: RBAC draft/review/approve/send/expire, active catalogue/server cycle validation, supplier margin/tax constraints and locked re-quotation at conversion. No user-supplied arbitrary total can create orders.
- Print Queue: bounded encrypted export jobs, private ownership, signed access, retry/expiry and storage audit. No fake email/print receipt.
- Distinct paid receipt and credit-note workflows with verified gateway settlement and refund evidence, never just a status toggle.

### Batch 17 — Batch Billing, Renewal and Collection [P0/P1]
- Preview recurring invoices with unique (service or domain, billing period, charge type, tenant) idempotency; no duplicates on retries.
- Approved scheduler, durable queue/outbox, leases, DLQ, tax/discount/proration snapshots, renewal reminder/dunning, grace periods, cancellation and arrears reports.
- No automatic card charge, account suspension or domain renewal without explicit provider/consent/financial gates.

### Batch 18 — Staff Management and Blacklist [P1]
- Reuse CustomUser, StaffProfile, RBAC and audit; role-scoped invitation, MFA, privilege reviews, account disable and session revoke. Separate staff operations from full admin.
- Blacklist: versioned allow/deny rules for normalized IP/domain/email/user; reason, expiration, challenge/appeal, owner and evidence, false-positive rollback, enforcement tests. No uncontrolled global denial.

### Batch 19 — CMS and Download Manager [P1]
- Inspect existing content/Settings first; authorized drafts, preview, approval and rollback, SEO and XSS-safe frontend. Avoid duplicate content records.
- Private malware-scanned attachments, MIME/size limits, encryption, tenant ownership and time-limited delivery URLs. No public arbitrary executable download.

### Batch 20 — Currency Management [P1]
- Reuse existing currency fields, catalogue, invoices and gateway capability; verified FX feed, stale-rate freeze, Decimal rounding policy and consistent source/settlement currency snapshots. No repricing paid or issued historical invoices.
- Margin-after-provider-fees and currency arbitrage safeguards.

### Batch 21 — Mass Mailer + External Notifications [P1]
- Existing in-app notification inbox is not external delivery. Implement legal transactional-vs-marketing classification, opt-in/opt-out, verified sender, preview, durable outbox, suppression, rate limits, bounces, audit, retries and consent-safe campaign segmentation.
- Registrar-mandated reminders require real delivered messages and evidence, not only login notices.

### Batch 22 — Service Queue & OPanel entitlement [P0/P1]
- Reuse Services, provisioning jobs/receipts and OPanel bridge. Exactly-once-enough side-effect orchestration with lock/lease, idempotency, readback, compensation and customer status.
- Console owns login, ownership, active provisioned hosting and SSO; no OPanel customer signup. Preserve independent OPanel repository and its separate backups/jobs qualification.

### Batch 23 — External provider certification [P0]
- Actual registrar sandbox for domain registration, transfer, EPP, renewal, NS/DNS, DNSSEC; SSL lifecycle; hosting/VPS/email providers and gateway settlement.
- Verified vendor-specific credentials and rules, immutable supplier quotes/markup, authoritative price floor, audit logs, delayed settlement and safe rollback/compensation.
- Distinguish not-connected/quoted/pending/verified from genuinely executed. No provider action enabled just from a frontend button.

### Batch 24 — Reconciliation, resilience, compliance and launch [P0]
- Independent encrypted backup with tested restore; audited issuer/tax fields, staged NRS e-invoice eligibility and possible IRN integration only when legally required.
- Reconcile invoice -> gateway -> order -> supplier invoice -> provisioning -> refunds; watch SLO, stale jobs, retries, duplicate claims, margin deficits and secret rotation.
- Full Prod acceptance only with artifact/evidence/owner for all critical gates.

## The 11 Admin workspace integration map
| Workspace | Existing source / planned secure contract | Batch |
|---|---|---|
| Quotes | Quote model/API exists; unsafe mutations gated, server-priced drafting/approval/convert required | 16 |
| Batch Billing | Invoice, services and due dates exist; scheduler/idempotent preview absent | 17 |
| Print Queue | Existing PDF; durable jobs and private storage not yet proven | 16 |
| Invoice Designer | Simple PDF now; approved versioned editor/issuer profile needed | 16 |
| Staff Management | CustomUser and StaffProfile already exist; audited Admin contract needed | 18 |
| Blacklist | Auth/audit exists; versioned scoped enforcement needed | 18 |
| CMS | Pages and Settings exist; inspect before versioned publisher | 19 |
| Currency Management | Order/Invoice currency exists; qualified FX/settlement absent | 20 |
| Download Manager | Static resources exist; private uploads and scan pipeline absent | 19 |
| Mass Mailer | In-app notifications exist; compliant external delivery absent | 21 |
| Service Queue | Services/provisioning/OPanel jobs exist; unified Admin authoritative queue needed | 22 |

## Release guard
Work on existing review/cloud, qualify with isolated CI/Preview and exact SHA, then review PR to main and verify BOTH Vercel Production SHAs. Do not rerun the completed Batch 13 Neon migration. Any new Production migration requires a verified fresh recovery checkpoint, read-only preflight and operator approval. Never call a disabled capability implemented merely because UI looks finished. No synthetic live payments, notifications or provision claims.
