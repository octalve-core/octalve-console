# Octalve Cloud Console: Phase 3 routing and production release qualification
Date: 2026-10-27. Baseline: 6f16ede6a16c51eb41a4a0e8a560601dd672bcff

## Confirmed defect
Production Services/Domains continued to display error states even after PR #38 because the browser's API client used /services/ and /domains/ while Django actually registers /api/services/services/ and /api/domains/domains/. BFF adds /api and forwards the remaining path correctly. This was a verified route-contract bug, not a UI style problem.

## Corrections on review/cloud
- Correct Client Services and Domains list/detail roots, normalize trailing slash in byId.
- Reconcile Admin read roots against actual Django routers without loosening RBAC.
- Correct Wallet read to /wallet/my-wallet/me/; adapt validated Django balance/currency into frontend WalletBalance. Never fabricate zero.
- Mark unconnected wallet funding and DNS editing unavailable; fix other actual DNS action paths while backend provider mutations remain disabled.
- Add CI route-contract guard, and isolated populated-account owner-vs-other-tenant API tests including secret redaction.
- No migrations, customer financial writes, registrar/provisioning/provider requests, CSS deletion, or OPanel entitlement changes.

## Phase 3 release sequence
1. Verify exact branch head, frontend TypeScript/Next tests, Django security/ORM and disposable PostgreSQL CI.
2. Merge SHA-locked review/cloud into main only after CI success, then fast-forward review/cloud and check Console/API Vercel deployment statuses.
3. Live login as synthetic Client, Staff, Admin: ensure correct service/domain/wallet API HTTP status and actual tenant records; deny other-tenant and wrong-role. Verify empty, populated, timeout and stale states. No live financial operations.
4. Complete the 123-route x six-viewport authenticated browser matrix. CI plan creation alone is NOT browser evidence.
5. Verify actual Production Neon ledger and backup read-only before **any** unrelated schema migration. This batch requires none; do not use an old initial schema runner.
6. Keep payments, hosting vendor creation, registrar, DNS and OPanel production gates OFF until external authority is qualified. Phase 4 retains those implementations.
7. Retain 8,526-line global stylesheet until genuine legacy CSS dependencies and browser parity are cleared.

## Limitation
This execution could inspect Django routers and isolated tests, but not any live authorized user's HTTP response or Vercel runtime trace. Deployment READY is not the same as authenticated feature acceptance. For unresolved errors, collect only request path, HTTP status, content type and opaque request ID; do not copy cookies, JWT, PII or response bodies.
