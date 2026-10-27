# Octalve Cloud — B1 inert provider credential vault, Review-only qualification
Parent https://github.com/octalve-core/octalve-console/issues/54

## Invariants
- New Django schema `providers.0002_integration_draft_vault`: IntegrationConnection, IntegrationCredentialVersion and IntegrationConnectionEvent. Existing Provider and SupplierPackage data **unchanged**.
- Existing legacy Provider CRUD remains 503 (B0). New /api/providers/connections/schemas/ is a strict server-owned manifest for four vendors: DirectAdmin, WHM, Cloudflare DNS and Resend. Twenty-one vendors in frontend A2 remain informational; this does NOT turn them into live adapters.
- New POST connection draft, POST /rotate and POST /revoke routes use internal supplier authority, superadmin role for writes, explicit current-password check, throttle and `CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=false` by default. Production startup does not require an encryption key until explicitly authorized Review writes.
- `CLOUD_PROVIDER_VAULT_KEY` must be a distinct 32-byte Fernet key (outside Neon / source, not the legacy `ENCRYPTION_KEY`). Ciphertext is AEAD/authenticated encrypted, bound inside payload to adapter, connection UUID and version; version identifiers are recorded with ciphertext, and stale versions marked revoked.
- Public fields are exact vendor schemas, no arbitrary JSON; DirectAdmin/WHM HTTPS hostname must match exact server-managed `CLOUD_CONNECTION_ALLOWED_HOSTS` and supported ports. No DNS resolution or arbitrary SSRF-capable HTTP in this batch; later outbound adapter must separately verify DNS/IP and egress.
- GET list/detail is redacted (never returns `secrets`, ciphertext, password, or encryption key); `execution_enabled` always false; state is draft or revoked; no activation/qualification is possible.
- Audit rows include actor, action, version and timestamp only, never credentials. Treat as application-level append-only; DB hardening against privileged tampering is a subsequent gate.
- No secret values in URLs, logs or audit. All token fields encrypted at rest; no dynamic vendor host chosen at execution.
- BFF uses existing authenticated same-origin /api/cloud session proxy and provider namespace. No separate OPanel login or supplier executive token sent to client.

## Important unqualified gates
The existing `two_factor_enabled` account Boolean is **not an MFA authentication proof**, so the current-password check provides reauthentication only. Never enable this flag in Production until genuine step-up MFA, credential misuse limits, controlled key management and safe isolated recovery have been independently certified. No outbound supplier API operation or paid customer provisioning occurs from this vault.
B1 schema must be examined on disposable PostgreSQL before authorizing the Production Neon migration. Existing Vercel rate limit still blocks live review/production validation.

## Review acceptance
Run source/CI `makemigrations --check --dry-run`, targeted `providers.test_draft_vault`, existing supplier regression, read-only catalogue/build and disposable PostgreSQL DB acceptance. Ensure malicious host, arbitrary fields, wrong role/confirm password/key, mutation flag OFF, secret redaction, rotated version/stale lockout, revoked stop and audit are all tested.
