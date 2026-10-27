# Provider B0 — close unsafe legacy credential entry
Baseline `69baded1d10534e0a17ad740f0ac2ef95904db4f` (A2 Integration Store merged). NO database migration or Production writes.

## Source finding
The existing Django `Provider` model has generic config/metadata JSON and may default status to active. Though the old Admin frontend provider-creation page was retired in A2, the legacy DRF ModelViewSet still accepted create/update/PATCH/delete, and serialized unrestricted JSON from existing records. The Django Admin page displayed ciphertext fields and a broken Test Connection link. Provider logs used IsAuthenticated and had a global stats endpoint.

## B0 safety change
- Deny all legacy Provider CRUD mutations with 503 after Admin permission checks. Preserve Admin-only list/detail/health and existing read-only provider package inventory under its existing explicit HTTPS host allowlist. No new adapter or live connection enabled.
- Redact config/metadata/health notes in Admin API response. Preserve ONLY whitelisted `config.fulfillment_model` for existing Catalogue workbench consumers.
- Provider logs/stats require internal supplier Admin authority; suppress generic vendor response errors, raw endpoint and metadata from the API response.
- Make Provider Django Admin view-only without exposing encrypted ciphertext, unrestricted config, or the broken connection test button. Existing account bindings and provider rows are not altered.
- CI tests require redacted GET, denied customers, rejected Admin POST/PUT/PATCH/DELETE, unchanged database count and read-only Django Admin.

## Remaining B scope
Dedicated versioned encrypted credential store with real rotation, MFA step-up, per-vendor schemas, approved network egress, audited connection testing, server-authoritative capability approval and security qualification before enabling any vendor. Never treat this hardening as a functioning credentials interface.
