# Octalve Console — Batch B guarded lifecycle acceptance

Date: 28 October 2026. Depends on draft Batch A PR #76. Batch B PR #77 targets the Batch A branch; do not merge independently to Production.

## Delivered source contracts

1. Internal wallet posting uses a single transaction and `select_for_update()` on the wallet row, with positive two-decimal amount bounds, active-wallet checks, overdraft refusal and reference-bound replay semantics. Historical ledger entries reject ordinary ORM edits and deletions.
2. Public wallet invoice payment, automatic-payment preference mutation and direct manual wallet adjustments remain closed under Batch A. Batch B does NOT create a payout, deposit-verification, money-loading or invoice-paid shortcut.
3. Manual queue `retry`/`cancel`/`needs_review` transitions are row-locked and logged. Retries/cancellation only affect safe read-only sync tasks. Provider-changing operations cannot be retried/cancelled through those HTTP operations; execution remains disabled.
4. Customer owner-scoped cancellation `request-cancellation` records a deduplicated review request without changing the service status, entitlement, invoice, vendor account or OPanel proof. Staff cannot impersonate a customer; administrators can record an operational review request. It does not promise that a cancellation was executed.
5. The legacy service change-request `complete()` method is intentionally refused; package price/state updates require future verified provider and financial reconciliation.
6. Super Admin-only `validate-change` checks a tiny non-secret Settings allowlist without persistence or echoing proposed content. There is NO Settings apply endpoint and no vendor, tax, payment or security configuration authority enabled.
7. The existing independently provider-verified gateway settlement path is preserved, default-gated and not replaced by wallet logic.

## Acceptance evidence

- Backend Django regression: `backend/tests/test_batch_b_lifecycle.py`
- GitHub lightweight Security and full frontend build unaffected.
- Disposable PostgreSQL CI runs `python manage.py test tests.test_batch_b_lifecycle`; this is the only accepted evidence for true row locking under concurrent same-reference posts, conflicting debits and simultaneous owner cancellation requests.
- Django CI also runs routed API, owner/role checks, ledger replay, secret-setting refusal, terminal state refusal and package-change guard.
- Gate status should only be updated against PR #77's exact final head SHA and successful GitHub Actions jobs.

## Important limits — not a production launch authorization

- Historical WalletLedger records can still be changed through privileged raw SQL and database cascading behavior. ORM-level append-only rules do **not** equal WORM custody or database-level immutable retention. Stronger DB privileges and schema migration need a separate, vetted retention review.
- Legacy model-level deposit/withdrawal completion methods need a subsequent approved reconciliation authority. They are **not** exposed through the Batch B routed HTTP actions. No financial movement or payout capability is newly enabled.
- Existing internal code paths without an explicit wallet reference remain non-idempotent by contract; never use them for retryable external financial events. Do not activate money-moving workers until every caller has a verified unique reference and refund/chargeback policy.
- Cancellation review uses historical ServiceActionLog. It is not a durable multi-stage cancellation order; a dedicated request state machine and worker/effect evidence are still needed before cancellation processing.
- The Settings validation allowlist is deliberately small; it does not permit secret edits, automatic settings saves, or dynamic reconfiguration of application security, integrations or provisioning.
- No MFA/KMS provider acceptance, customer browser click-path evidence, external invoice snapshot acceptance, vendor certification, Production migration or Production deployment is represented by these CI passes.

## Implementation research

- Django 6.0 row locking: https://docs.djangoproject.com/en/6.0/ref/models/querysets/#select-for-update
- Django transaction tests: https://docs.djangoproject.com/en/6.0/topics/testing/tools/#transactiontestcase
- DRF permission and per-object access: https://www.django-rest-framework.org/api-guide/permissions/
- OWASP Business Logic Security: https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html

## Release protocol

1. Review and approve Batch A PR #76 first, without auto-deploying Production.
2. Verify the exact Batch B PR #77 head, all four CI jobs, and independently inspect both stacked changes.
3. Keep the existing `main` Production deployment hold; merging to `main` may trigger both Vercel projects. Do not merge without an explicitly approved release window.
4. Next implementation gate: canonical approved financial reconciliation, database-level ledger retention, stateful service-change/cancellation worker, and approved Settings write + real MFA custody (separate scope).
