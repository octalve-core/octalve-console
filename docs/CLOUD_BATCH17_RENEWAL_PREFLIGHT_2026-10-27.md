# Octalve Cloud — Batch 17.1 Safe Renewal Preview (No Billing Execution)

Date: 27 October 2026
Base: Batch 16.2 merged main 93be8252eadf4baa0ef8f6f85979c76c11e21947.

## Delivered
- Admin-only GET /api/billing/invoices/renewal-preview/?days=30 reuses Service and Invoice. No new models, migrations, scheduling, invoice creation, payment action or provider mutation.
- Validated 1–90-day look-ahead, capped to 50 rows with explicit truncated flag and lower arrears bound (60 days). This is NOT a comprehensive statement of all outstanding debts.
- Existing unpaid/partial/overdue renewal invoices are flagged conservatively. Service opt-outs, one-off plans and inactive states are explicitly separated. Every other row is **needs_billing_policy_review**, not eligible for autonomous billing.
- Admin Billing Batch workspace now shows these actual records via authenticated Django BFF rather than a fake queue or unconnected placeholder. No action buttons and no invented final invoice price.
- Regression tests verify anonymous/client denial, parameter bounds, opt-out and duplicate-candidate warning, zero new invoices and unchanged service state. Frontend source contract enforced by CI.

## Required before moving to recurring automated invoices
1. Immutable, verified (tenant, service/domain, charge category, UTC billing period) unique idempotency key with a database unique constraint. No JSON-key-only uniqueness, no unsafe select-then-create race.
2. Durable job/outbox, leased workers, auditable retries and DLQ with current catalogue/server-priced terms, currency, supplier cost, fees, tax and issuance-time snapshot.
3. Policy for opt-in/opt-out, re-quotation, prorations, grace periods, arrears and overlapping periods. First review real provider/vendor contract and settlement costs.
4. Final approval for any automatic collections, suspensions, renewal attempts, gateway/registrar writes and customer notices. No partial rollout based on code-only CI.
5. Signed-in Admin browser review, both Vercel deployments and exact SHA/monitoring checks after build limit recovery.

This tranche requires no Production migration. It is not sufficient to certify Batch 17 overall.
