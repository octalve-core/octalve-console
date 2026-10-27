# B2.4 — Keyed event-chain and PostgreSQL append-only enforcement
Issue #54, following PRs #60–#62. Additive provider migration 0004; NO Production Neon migration run.

## Threat model
- Previous Provider Vault events recorded actor/action/version without a cryptographic seal or DB immutability. A compromised database operator could edit or delete events without detection.
- New signed HMAC-SHA256 receipt binds connection UUID, monotonic sequence, action, version, actor ID, creation timestamp and preceding digest. The separate 32-byte `CLOUD_PROVIDER_AUDIT_KEY` lives outside source/Neon and MUST not equal the vault/stepup/legacy keys.
- Each create/rotate/revoke verifies the entire bounded prior chain (max 1000) inside the credential DB transaction, then signs and appends a new row and updates the connection head/sequence. Missing key, unsigned legacy events or corrupt chain refuse writes.
- PostgreSQL migration 0004 installs `providers_event_append_only` trigger prohibiting UPDATE/DELETE of event rows. Model-level save/delete also refuse historical changes; SQLite's tests simulate privileged tampering and check HMAC detection.
- Historical actor FK now uses PROTECT: removing a Super Admin must not silently rewrite its signed audit events. Use deactivation rather than hard deletion.
- `python manage.py verify_provider_audit` checks all bounded rows without printing secrets. Outbound vendor API calls remain disabled; no automatic external audit service is introduced.

## Important remaining boundary
This is **tamper-evident within an operator-protected database**, not an external immutable/WORM receipt. Privileged complete rollback of both connection head and signed historical events is not detectable without an externally retained checkpoint. Independent WORM export and real isolated full Neon backup restore require explicit qualification before live credentials.
Migration requires disposal CI plan 58 migrations/111 tables and PostgreSQL trigger verification. Existing customer, billing, OPanel and supplier execution paths untouched.
