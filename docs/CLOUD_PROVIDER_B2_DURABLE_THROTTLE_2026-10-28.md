# B2.6 — shared PostgreSQL rate-limit enforcement for provider secrets
Scope: Octalve Console provider-vault step-up and draft credential API only. Baseline main db944d6b46fac0d9da9782c90784fe493dac70b9.

## Review finding
The B2.1 Provider Vault used DRF `SimpleRateThrottle`, whose default cache can be instance-local. In a horizontally scaled Vercel API this is not a durable security limit. Octalve already provides vetted, transaction/row-lock backed `accounts.security_throttle._spend` and `AuthThrottleBucket` from its SEC-01 program. Reuse this authority rather than introducing another migration or a weaker in-memory counter.

## Implementation
- All authenticated POST operations on the vault step-up and credential lifecycle routes now consume the **same** per-account ledger budget of 10 attempts per hour, whether the attempt succeeds or fails. GET remains unthrottled after Admin RBAC.
- The rate limit is enforced with database row locks across API instances. Over the limit returns HTTP 429 and Retry-After. If the ledger database cannot be reached, operations return a redacted HTTP 503 instead of falling back to the process cache.
- No secret values, password, OTP or IP address is persisted in the rate-limit record; its fingerprint is derived via the existing SEC-01 HMAC mechanism. Deactivation, credentials, customer billing and OPanel remain unaffected.
- Django tests flush the local cache between denied requests while counting up to the shared limit, and simulate an unavailable database ledger to require fail-closed behavior.

## Remaining release boundary
This does not enable Production credentials. True WebAuthn step-up, MFA recovery, independent WORM/immutable backup storage, KMS service, real VPS and network-level egress qualification are outstanding. No Production Neon migrations or provider API calls in this batch.

References: https://pages.nist.gov/800-63-4/sp800-63b.html and https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
