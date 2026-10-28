# Octalve Console Batch D — Security hardening and outstanding external certification

**Review scope:** 28 October 2026. Stacked on Batch C PR #78, Batch B PR #77, Batch A PR #76. No Production activation or deployment is authorized by this document.

## Source changes

### Session resilience, fail-closed identity verification
- The Next.js route proxy treats explicit identity rejection (401 or 403) separately from backend unavailability, timeout, HTTP 5xx or invalid successful responses.
- On 503/unreachable identity service, protected pages return a bounded non-cacheable 503 without displaying protected data, refreshing tokens, deleting cookies or redirecting to Login.
- Only verified rejection can trigger the login redirect and browser cookie removal. Refresh and renewed access identity must both be verified.
- Identity readback must return a valid account ID and email, not an empty JSON body.
- The React AuthContext retains the last verified user on an ambiguous failure but reports an explicit transient-failure state. RoleGuard withholds protected page children and offers a manual retry instead of sending the user to Login.
- No automatic retry of credential-changing requests, no browser JWT exposure and no relaxation of staff/admin role authority.

### Provider credential release interlock
- Existing supplier connection mutations remain default-off, requiring active Super Admin account, current password and a server-verified, replay-limited RFC6238 TOTP code, plus a durable throttle and independently configured keys.
- A second **default-off** `CLOUD_PROVIDER_VAULT_WRITE_RELEASE_APPROVED` setting now gates sensitive credential mutations. The ordinary `CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED` flag alone is insufficient.
- This is an additional release interlock, **not proof of a WebAuthn ceremony or external KMS acceptance**. Test-only synthetic writes explicitly configure both gates.
- Credential submission UI remains disabled. No supplier operations are authorized by storing a draft.

### Key separation and audit / recovery protection
- Vault encryption, authenticator secrets, event audit HMAC and encrypted isolated recovery now reject any reuse of all other configured key roles, including externally retained checkpoint keys and Django's unrelated encryption key.
- Historical keyring entries must also not reuse any of those role keys. Encryption/decryption and recovery continue to fail closed on absent, malformed or mismatched key material.
- Existing offline KMS envelope wrapping, pinned supplier transport, signed audit checkpoint, synthetic WORM custody and isolated SQLite restore tests remain in scope and MUST stay green. Their source qualification does not turn on AWS or vendor traffic.
- Source recovery remains **read-only** and synthetic. Independent WORM object retention, external recovery restore drills and KMS grant ownership have not been certified in Production.

## Qualification plan

- `node frontend/scripts/check-batch-d-auth-resilience.cjs` runs the actual TypeScript proxy transpiled with mock Next runtime. It asserts no-cookie-loss and non-cacheable 503 on network errors and provider HTTP 5xx, explicit rejection on HTTP 401, verified 200 identity and successful token refresh.
- `providers.test_batch_d_key_separation` checks all key purposes and forbidden key collisions without external IO.
- `providers.test_batch_d_release_guard` asserts either release flag alone cannot enable sensitive writes.
- Existing provider TOTP replay, HMAC chain, recovery corruption, key rollover, strict read-only pinned TLS, synthetic KMS and WORM tests remain mandatory.
- Full existing Django, frontend, security and disposable PostgreSQL checks must pass at the **exact final PR SHA**. No actual browser screenshots or device/passkey testing is claimed by CI.

## External security gates still outstanding — do not claim completion

1. **WebAuthn passkeys/hardware keys:** reviewed authenticator library and locked version; per-admin single-use database challenge; exact origin/RP ID, user verification, signature/counter verification, recovery and hardware/browser acceptance. The existing TOTP is genuine step-up but not phishing resistant. No WebAuthn is claimed deployed.
2. **External AWS KMS/HSM:** customer-controlled AWS account, key policy, least-privileged IAM role, endpoint allowlist, envelope integration, key version and outage handling, independent key rotation and readback. Offline KMS stubs are not cloud custody.
3. **Immutable recovery:** independently retained S3 Object Lock COMPLIANCE mode or equivalent, protected account, independent checksums, signed retention receipts, isolated restore from real version-pinned artifacts, missing/corrupt/wrong-key tests and recovery operator approval.
4. **Supplier egress and DirectAdmin/WHM:** network-policy enforcement independent of application code; read-only certification against isolated vendors; exact account/plan validation, no redirects, pinned verified TLS and outcome reconciliation. All live supplier calls remain off.
5. **Authenticated visual browser acceptance:** real Admin and Client sessions, desktop/tablet/mobile screenshots, session expiry flow, Settings/Integrations/Provisioning/invoice routes. None of this is inferred from a successful Next build.

## Release sequence

Review the entire stacked chain PR #76 → #77 → #78 → the Batch D draft. Merging to `main` may deploy two Vercel Production projects. Maintain the Production Neon, payments, provider credentials, execution and deployment holds pending separate release approval and externally verifiable evidence.

## Research links
- NIST SP 800-63B authenticators and session assurance: https://pages.nist.gov/800-63-4/sp800-63b.html
- WebAuthn Level 3 assertion verification: https://www.w3.org/TR/webauthn-3/
- AWS KMS encryption context semantics: https://docs.aws.amazon.com/kms/latest/developerguide/encrypt_context.html
- Django REST Framework object and action permission design: https://www.django-rest-framework.org/api-guide/permissions/
- OWASP SSRF defense: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
