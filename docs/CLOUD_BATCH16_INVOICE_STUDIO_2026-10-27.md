# Octalve Cloud — Batch 16.1 Invoice Studio and Billing Authority Safeguards

Date: 27 October 2026
Base: main 73281eab7832f6ec270d13f0363571fa49ab64dc (Batch 15.1).

## Implemented safely, without a database migration
1. Django InvoiceViewSet generic CRUD operations now return 503 even for Admin. Prior generic ModelViewSet writes allowed Admin to submit paid status, customer ID or subtotal/total without payment verification. Existing owner-scoped GET and PDF download remain.
2. Quote.convert_to_order() fails closed at the model boundary until verified live catalogue repricing and locked financial conversion are implemented. Existing Quotes GET remains, legacy writes still closed.
3. Read-only, admin-guarded GET /api/billing/invoices/templates/ returns the allowlisted server code registry; no dynamic modules, saved template HTML, alternate financial amounts or arbitrary template IDs.
4. Admin-only GET /api/billing/invoices/template-preview/?template_id=template_01 uses the existing approved Template 01 renderer and fictional fixture, not a customer record. It does not create invoices, send mail, download private data or claim settlement.
5. /admin/invoice-designer reads the catalogue through the existing HttpOnly-cookie BFF; the only preview link is pinned to the reviewed same-origin route. No unconnected Save button, no fake records, no DOM-injected templates. UI is TypeScript + Tailwind.
6. Automated Django checks cover Admin mutation refusal, unchanged financial ownership/status/total, no new invoices, owner/public preview refusal, template allowlist, synthetic PDF and closed quote conversion. Frontend regression enforces readonly contract.

## Required before completing full Batch 16
- Persist signed **immutable** rendered document snapshots and verified legal issuer identity after issuance; a metadata template ID is not an immutable PDF. Storage, retention, safe customer reprints, adjustments, receipts and credit notes need their own reviewed schema and migration/recovery approval.
- Template drafts: constrained versioned settings schema, active/default scheduling, approval and rollback. Never edit Template 01's existing code in-place once already issued without snapshot guarantees.
- Quotes: catalogue-priced line selection, supplier cost and margin floor, tax handling, independent Admin review, email state, expiry, customer acceptance and re-quote at conversion. No arbitrary price, currency or role escalation.
- Print Queue: job ledger and idempotency, bounded content, encrypted immutable storage, ownership-checked signed retrieval, audit, retries/expiry, acknowledgement **only from a trusted printer/export worker**, not a UI click.
- Real API/Console deployments and role-correct browser acceptance after Vercel quota is resolved.

## Release gate
CI-only source qualification is explicitly authorized while Vercel Review is failing. This does not authorize financial operations or confirm production. Do not apply Production migrations, activate Rewards/marketing, collect payments, provision hosting, or claim full Invoice Designer/Quote/Print Queue completion.

## Reference
https://docs.djangoproject.com/en/6.0/ref/class-based-views/
https://www.django-rest-framework.org/api-guide/viewsets/
https://owasp.org/www-project-api-security/
