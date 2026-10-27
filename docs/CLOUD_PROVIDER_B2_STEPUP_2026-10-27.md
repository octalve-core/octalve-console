# B2.1 — Provider-vault-only MFA step-up (2026-10-27)
Existing source main: 58bef3e215ec006aaae168730516ac9bd67eba59. Part of issue #54.

## Research and choices
NIST SP 800-63B-4 requires replay resistance for OTP and rate limits; RFC 6238 supplies HOTP/HMAC-based time-step TOTP, with one-time acceptance; OWASP requires reauthentication for high-risk actions. References:
- https://pages.nist.gov/800-63-4/sp800-63b.html
- https://www.rfc-editor.org/rfc/rfc6238
- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- https://cryptography.io/en/stable/fernet/

## Implementation
- Separate model `providers.0003_provider_vault_authenticator`, one-to-one with an active Super Admin, encrypted TOTP seed and last-accepted counter. It does NOT use or set the account's pre-existing `two_factor_enabled` Boolean.
- Enrollment: `POST /api/providers/security/stepup/enroll/` current-password proof, short-lived five-minute pending enrollment, once-only seed/otpauth URI (never stored in logs, returned with no-store). `POST /api/providers/security/stepup/confirm/` requires password plus actual six-digit TOTP. Do not paste enrollment seed in external chats or tickets. Pending enrollment cannot displace an already verified authenticator. Recovery/reset deliberately requires a separate reviewed process; no automatic email reset or password-only bypass.
- Each provider create/rotate/revoke now additionally requires `totp_code`; verification locks its Super Admin authenticator row and atomically records the accepted time-step, preventing OTP replay across requests (including multi-process deployments with PostgreSQL row locking). Adjacent ±1 time window handles clock skew; 10/hour throttle still applies to provider writes/enrollment.
- Independent `CLOUD_PROVIDER_STEPUP_KEY` (Fernet) must not equal provider-vault key or legacy encryption key. `CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED=false` and `CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=false` by default; missing or malformed keys reject operations. Existing no-migration environments return 503 for step-up status rather than a server error.
- Source-locked customer auth, billing, OPanel, domain actions, existing Provider CRUD and all vendor HTTP remain unchanged.
- Tests verify password denial, enrollment/confirmation, revoked/replayed OTP, no future unenrolled write, key isolation, disabled flag, three supplier-secret actions and unchanged surrounding CI.
- One reviewed, additive providers.0003 migration creates only one table; isolated PostgreSQL ledger 57 migrations/111 tables, historical 49 preserved.

## Not certified yet
- Phishing-resistant WebAuthn or backup key recovery, independent MFA account recovery authority, external KMS-backed key custody/rotation, tamper-evident persisted audit, direct egress control, and isolated restoration.
- No real credentials, BFF credential-entry UI, provider activation, or Production Neon migration authorized. Vercel Production build-rate limit persists.
- This is a **provider vault step-up**, not a statement that ordinary Console login MFA is ready or that security reviewers have approved Production credentials.
