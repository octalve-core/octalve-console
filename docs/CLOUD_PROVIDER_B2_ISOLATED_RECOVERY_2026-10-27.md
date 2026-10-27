# B2.5 — Review-only encrypted vault snapshot and isolated verification
Issue #54. No schema migration, API route, network or live data access.

## Scope
- A bounded source snapshot captures provider connection metadata, **already encrypted** credential versions, and separately signed audit event receipts. It verifies the entire event chain and each recorded credential binding before encrypting the snapshot again under an **independent** `CLOUD_PROVIDER_RECOVERY_KEY`.
- Source extraction is off unless `CLOUD_PROVIDER_SNAPSHOT_REVIEW_ENABLED=true`; it returns encrypted bytes in-process and does not write to disk, network, S3, R2 or object storage. It uses a bounded source SQL transaction with connection row locks.
- A separate verifier decrypts the snapshot and reconstructs its records in a **new independent SQLite in-memory database**, validating cryptographic binding to connection UUID/vendor/version and HMAC audit sequence. No writes to the source Django database occur.
- Tests use only synthetic example.invalid supplier metadata and nonfunctional credentials. They verify successful isolated validation, source DB unchanged, wrong recovery key, altered Fernet token, forged connection identity, corrupted credential and missing audit events/key.
- A backup encryption key must remain outside the codebase, Neon and logs and must differ from provider, step-up, audit and legacy encryption keys.

## What this does not qualify
- This is a narrow credential-vault **record-level restore verifier**, not a complete recovery of Production Neon, mail, hosting files, panel systems or customer services. No real WORM object-storage receipt or offsite retention is provided. A human-approved, full isolated disaster-recovery exercise is still necessary.
- Production Neon migrations providers.0002–0004 remain separately gated; no customer-facing credential form or vendor provisioning activated.
- External KMS/HSM key custody and network-level egress policy remain operations gates before Production secret entry.

Reference: https://cryptography.io/en/stable/fernet/ and https://pages.nist.gov/800-63-4/sp800-63b.html.
