# Octalve Cloud — Batch 13.2: Rewards Financial Acceptance and Launch Gates
Date: 27 October 2026
Parent release: PR #45 merged at 1f9ed7ec22523d44eeac35b5cdf4160aed3c032e.
This batch is **security hardening and qualification only**. NO rewards activation, redemption, payout, gateway charge, supplier provisioning, new migrations or Production data writes.

## Verified current state
- The guarded Production operator migration already passed at 55 migration records and 107 PostgreSQL tables. Never rerun rewards.0001_initial.
- The next reviewed source is merged Invoice Template 01, which is independent of rewards and requires no migration.
- Read-only Vercel API environment inventory on 27 October: 56 visible environment variables, 0 hidden production variables, no REWARDS_API_ENABLED variable. Backend settings default this toggle FALSE. This is configuration evidence, not proof of authenticated live API behavior; maintain that distinction.
- No customer/admin payout or checkout redemption API exists in this programme. MyRewards advertises redemption_available=false and commission_payout_enabled=false.

## Specific security defects fixed in Review
1. RewardTier preview used min(tier cap, policy cap) but did not enforce an **absolute N2,500** maximum if both saved settings were higher. New code applies the mandatory hard cap even if configuration changes.
2. A newly initiated refund in pending/processing state did not necessarily prevent a fresh award. New points must freeze on any known refund record until manual reconciliation, irrespective of untrusted local finality. Existing full-award reversals remain idempotent and require verified successful refund evidence.
3. Distinct internal payment rows could re-use the same nonempty provider_reference and be double-counted toward settlement. The new grant check refuses repeated nonempty gateway charge IDs for the same invoice.
4. Refunded original payment rows cannot be counted as eligible payment evidence.
5. A separate **offline** financial guard now uses only verified Decimal NGN, pretax price, coupon reduction, requested reward, supplier cost, gateway fee and affiliate liability. Rejects invalid/unverified values and enforces 5% after existing discounts, N2,500 absolute benefit, and 20% minimum net contribution **after** supplier + gateway + commission. It cannot write orders or redeem points, and is NOT hooked into checkout while supplier fee snapshots and atomic reservations are not certified.

## External references and engineering decisions
- Paystack Verify Payments: https://paystack.com/docs/payments/verify-payments/ confirms provider-side success and warns against duplicate delivery.
- Paystack Refunds: https://paystack.com/docs/payments/refunds/ distinguishes pending/processing/failed/processed and requires webhook reconciliation.
- OWASP Business Logic Security: https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html recommends independent financial authority, per-object permission, atomic row locks, event deduplication and concurrent tests.

## Gate matrix
| Acceptance | Evidence required | Status |
|---|---|---|
| Production DB schema (one-time) | Operator preflight, 55/107 | Passed previously |
| Two Production deployments at PR45 SHA | Vercel READY with 1f9ed7e | Passed |
| Production toggle not explicitly set | Vercel env inventory + default false | Config evidence obtained; authenticated smoke pending |
| REST role/owner gate | Synthetic client, other client, staff, admin, anonymous tests | CI pending |
| No points on partial/false settlements | Django isolated fixture tests | CI pending |
| Refund processing freezes new grants | Django fixture tests | CI pending |
| Charge duplicates not counted twice | Django fixture tests | CI pending |
| One award under PostgreSQL races | Shared disposable PG, 8 competing requests | CI pending |
| Financial caps and supplier cost/fees | Pure Decimal offline tests | CI pending |
| Verified private recognition | Existing Django cross-tenant tests | CI pending |
| Actual vendor settled refunds/chargebacks | Signed external provider reconciliation | NOT COMPLETE |
| Checkout reservation/redemption | Locked order/offer/cost snapshot, stacking audit and refund | NOT IMPLEMENTED |
| Commission accrual/KYC/payout | Settlement ledger and approved audit | NOT IMPLEMENTED |
| Financial production activation | Operator-specific signed deployment and smoke | NOT APPROVED |

## Operator release protocol
1. Review Batch 13.2 PR at its exact head. Require both existing CI workflows green on Review and no new migration.
2. Verify Production REWARDS_API_ENABLED remains unset or explicitly false. Confirm Console/API READY matching latest main SHA and verify health through authenticated operational monitor; deployment status alone is not runtime health.
3. No Production tests may create artificial orders, fake payments, rewards, payouts or provider changes. Use disposable PostgreSQL synthetic fixtures.
4. Merge hardened source only after all CI/Review gates pass; check both Production deployment SHAs.
5. Proceed to Batch 14 multilingual without enabling financial effects. The real money/redemption launch remains a separate sign-off.

## Further required before paid launch
- Immutable verified gateway + refund provider IDs and event snapshots; a local webhook_verified boolean alone is insufficient proof of independently reconciled settlement.
- Confirmed and audited gateway cancellation/chargebacks, partial refunds, duplicate provider notifications and staged settlement status.
- Canonical supplier cost from actual provider quotes; taxes and FX, per-plan fee classification and fee-inclusive margin, no client-supplied cost.
- Atomic order-bound discount reservation, replay expiry, client communication, controlled reversal, limits, fraud review, refund and ledger reconciliation.
- Real owner-scoped mobile/browser acceptance and Admin action audit logs; immutable event storage or compensating entries, no hidden discretionary point edits.
- Compliance eligibility for affiliate KYC, withholding/tax, verified payout account and independent payout authorization. Keep payouts OFF.
