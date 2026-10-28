# B2.9 — External KMS key-wrap interface, WebAuthn and recovery release criteria

Baseline: draft B2.8 PR #68. This source batch implements **offline KMS wrapping / unwrapping / re-encryption primitives only**. No AWS client, KMS key, HSM, live vault integration, WebAuthn authenticator or recovery authorization has been deployed.

## KMS implementation
- The new kms_custody module receives a specifically approved, separately instantiated KMS client and policy; there is no automatic AWS traffic, boto3 install or fallback to static keys.
- It binds each 32-byte Fernet data key to the intended KMS key ARN, independently configured environment scope and immutable application key-version through AWS symmetric EncryptionContext.
- Wrap and ReEncrypt require separate explicit approval. All encrypted data-key envelopes are bounded and never include the raw Fernet key. Decrypt validates returned KeyId, length and context; failures refuse access.
- ReEncrypt changes only the KMS envelope protecting a data key. It does NOT automatically change existing per-record Fernet data keys or retire old KMS material. The B2.2 transactional offline database rewrap remains a separate, reviewed operation.
- A decryption key is transiently returned to the trusted process in memory. This is NOT HSM-only encryption; AWS KMS cannot directly decrypt existing Fernet application ciphertext. A future production integration must eliminate plaintext key configuration from environment variables, enforce bounded key cache lifetime and zeroization where feasible, key-policy separation, credential issuance, endpoint egress control, outage behavior, and signed audit.
- Synthetic tests cover explicit approval, wrong scope/key/version, independent readback, staged KMS key rollover, preserved historical decrypt, outage and bad key material.

## MFA — still unqualified
- The current provider-vault TOTP is verified and replay-limited but is NOT phishing-resistant. Do not represent a user's two_factor_enabled Boolean or mere possession of an arbitrary credential ID as WebAuthn evidence.
- A qualified WebAuthn implementation requires a reviewed and pinned FIDO2 authenticator library; registration attestation and credential public-key validation; exact relying-party ID/origin and HTTPS controls; server-side unpredictable single-use challenges stored in the durable DB with expiry; binding to a particular authenticated Super Admin, intended sensitive operation and challenge; explicit userVerification required; signature validation and signCount/replay handling; protection against cross-origin and token substitution; account deactivation/credential loss logic; browser and hardware/passkey testing.
- Do not enable customer/vendor secret entry until real authenticator registration, assertion, recovery and browser journeys are accepted. Fake test assertions, password-only recovery, email-only reset or a browser-provided verified=true field must never authorize vault writes.

## Account recovery — still unqualified
- Require independently approved identity proofing or authenticators of sufficient assurance, dual-control adjudication for high-risk admin recovery, delayed notification, independent immutable audit and revocation of prior sessions/credentials. The recovery authority must not be delegated to a normal admin or customer BFF endpoint.
- Record operational tests: lost device, lockout, clock skew, recovered old authenticator, reset race, compromised email, inactive Super Admin, two people approving, and notification failure. Retain default-off flags until signed acceptance.

## Production readiness dependencies
- External KMS/HSM policy, IAM, provider-specific client, authenticated regional endpoint and egress must be provisioned and tested under separate authority.
- All historical ciphertext must pass isolated decrypt/recovery and backup before any KMS or Fernet retirement. Independent B2.8 WORM retention must be operational and independently verified.
- No Production Neon migrations, real credentials, Vercel deployment, hosting provisioning or supplier API calls in this PR.

References:
- https://docs.aws.amazon.com/kms/latest/developerguide/encrypt_context.html
- https://docs.aws.amazon.com/kms/latest/APIReference/API_Decrypt.html
- https://docs.aws.amazon.com/kms/latest/APIReference/API_ReEncrypt.html
- https://www.w3.org/TR/webauthn-3/
- https://pages.nist.gov/800-63-4/sp800-63b.html
