# B2.2 — Independent key custody and offline atomic credential rewrap
Reference: https://cryptography.io/en/stable/fernet/ (key rotation and authenticated decryption). Issue #54.

## Current supported path (no Production activation)
- Credentials remain encrypted at rest, using `CLOUD_PROVIDER_VAULT_KEY` and `CLOUD_PROVIDER_VAULT_KEY_ID`. Historical cryptographic keys may be loaded from `CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON`, an externally managed JSON mapping of key IDs to Fernet-encoded keys. The key-ID map, and the current key, **MUST remain in the infrastructure secret manager**, not code, database, uploaded backups or user messages. No KMS provider connection has been activated.
- `unseal_version` decrypts ONLY under the ciphertext record's declared key ID and compares the signed payload's immutable connection UUID, vendor ID and version. Wrong-owner, wrong-version, missing keys and bad ciphertext fail shut. The internal plaintext routine has **no HTTP handler**.
- The `rewrap_provider_vault` command defaults to a dry-run; checks up to 1000 historical versions (including revoked) before any changes. Explicit `--apply --confirm=REWRAP-PROVIDER-VAULT` *plus* a default-off `CLOUD_PROVIDER_VAULT_REWRAP_ENABLED` guard rewraps all in one database transaction, using `SELECT FOR UPDATE`. No outbound vendor HTTP, no secret values in stdout.
- Old key must remain securely retained until the rewrap is proven, backup recovery is independently tested, all active and historical versions are verified and a separate key-retirement approval is signed. Key rotation cannot repair corrupted ciphertext.
- Tests simulate missing key, bad ciphertext, swapped records, interrupted second write and atomic rollback with unchanged older record. They do **not** constitute real offline backup restore against an independent Production-sized Neon snapshot.

## Operator procedure (Review only)
1. Export database using existing separately approved encrypted backup process; keep data and decryption keys segregated.
2. Generate new Fernet key in a secret manager; maintain the old key in previous-key map; rotate active key ID. Do not put key values in tickets or GitHub.
3. With sensitive operations still disabled, run `python manage.py rewrap_provider_vault` for read-only preflight on isolated Review clone.
4. Only after approved backup and restore evidence, enable `CLOUD_PROVIDER_VAULT_REWRAP_ENABLED` in the isolated environment, run the explicit apply command, then dry-run again. Remove old keys only after independent decrypt recovery.
5. On any error, abort, investigate, retain both keys and use the isolated checkpoint. Never retry against Production blindly.

## Still required
KMS/HSM custody integration, approved cryptographic key rotation runbook with human separation of duties, independent immutable storage restore, origin/DNS pinned egress policy for real supplier calls, tamper-evident remote audit receipts and actual browser/MFA user journey. Neither provider activation nor Production secret-submission UI is enabled.
