# INT-02 — Portable Console Credential Vault and Owner Super Admin

## Why this exists
Commercial/provider API credentials are entered in the authenticated Octalve
Console interface, relayed over same-origin HTTPS BFF, encrypted using Octalve's
Django vault and persisted as ciphertext + version in PostgreSQL. They are never
written as individual Vercel environment variables or returned via read APIs.
This architecture migrates with the database and server-side key custody when
Octalve leaves Vercel. Do NOT claim it makes plaintext impossible in browser
memory at the time of entry or backend memory during encryption/verification.

Only a small bootstrap keyring, audit signing key and authenticator key (or
hardware-backed key-manager access) belong to host runtime configuration.
NEVER store those keys in the same database as ciphertext. For unrestricted
high-value Production supplier use, prefer a separately operated KMS/HSM or
Vault Transit key-management service with role-separated access, independent
backups, restore drills and rotation. The current Fernet AEAD implementation is
a portable app-level encryption vault, not hardware-isolated KMS. No provider
provisioning actions become enabled through this batch.

## Super Admin owner promotion
The intended existing owner is octalve0@gmail.com. Source does NOT
automatically elevate this email or a frontend role. Do this only against
the verified *correct Production database* from an authorized operator
environment. Make a snapshot and record its identifier before changes.

1. Verify the exact account exists, has its email verified, is active and
   has a usable password. Check owner identity out of band.
2. Determine the existing database user ID by an authorized read-only
   database/operator query; never guess it or create a second account.
3. From an authorized isolated Django backend operator shell, run:
   python manage.py approve_superadmin_owner --expected-user-id ID
   This is a DRY RUN and changes nothing.
4. With explicitly authorized change approval, and on that exact database:
   CLOUD_OWNER_ROLE_CHANGE_APPROVED=true python manage.py approve_superadmin_owner --expected-user-id ID --apply --confirmation PROMOTE-OCTALVE-OWNER
5. The command verifies email, account ID, active status, verified email and
   password presence, then atomically sets role=admin, is_staff=true,
   is_superuser=true and writes an audit receipt. It does not reset passwords,
   invite a new account, or expose an escalation route via the Console.
6. Log out all old sessions and authenticate again as the owner. Check the
   Django identity API returns actual role/staff/superuser flags. Require
   authenticator enrolment before provider credential access.

## One-time bootstrap and schema gates
Before enabling Production Console credential intake:
- Verify correct Production Django database (not unrelated Neon Vault).
- Back up DB and qualified migration plan. Check providers 0002, 0003 and 0004
  applied and the PostgreSQL append-only audit trigger exists. Apply audited
  migrations from approved backend operator context, never blindly.
- Generate separate independent 32-byte Fernet keys for
  CLOUD_PROVIDER_VAULT_KEY and CLOUD_PROVIDER_STEPUP_KEY, a separate independent
  32-byte base64url HMAC key for CLOUD_PROVIDER_AUDIT_KEY, and set a key ID
  CLOUD_PROVIDER_VAULT_KEY_ID (e.g. cloud-v1).
- Only the bootstrap KEK/keyring, audit key and step-up key are server
  infrastructure configuration, not per-provider API tokens. Protect the
  bootstrap keys with an external secrets manager/KMS, separate from Neon,
  with break-glass recovery and documented rotation. Retain old keys only
  for audited rewrap, never casually delete active decryption keys.
- Verify DEBUG=false and TLS/same-origin BFF, protected access and immutable
  audit retention. Run unauthorized/Staff/role-only Admin negatives, DB
  rollbacks, key mismatch, old-TOTP replay and restore drill.
- Separately enable:
  CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED=true
  CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=true
  CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED=true
  CLOUD_PROVIDER_CUSTODY_VERIFIED=true
  The last two are operator attestations, not cryptographic evidence. Backend
  *also* checks distinct actual vault/audit keys, PostgreSQL migration parity
  and append-only trigger, password, Super Admin role and used-once TOTP.
  All flags default false. Do not set them merely to make UI turn green.

## Console Admin flow
1. Sign in as an independently verified Super Admin, go to
   https://console.cloud.octalve.com/admin/integrations.
2. Select a provider with a reviewed backend schema (DirectAdmin, WHM,
   OPanel, Cloudflare DNS/Registrar Sandbox, Brevo, Resend).
3. The credential form reports readiness; if unavailable, nothing is sent.
4. Enrol a new provider-vault authenticator with account password and your
   authenticator's 6-digit time-based code. This is not phone OTP; keep
   recovery strategy separate from ordinary browser login.
5. Fill connection label, environment, exact approved non-secret settings,
   scoped secret, current password and a fresh code. The browser does not
   write these fields to localStorage/sessionStorage, URL, or persistent
   state; the server validates the complete payload and stores ciphertext.
6. The UI resets fields on submit. The subsequent API GET exposes only
   sanitized metadata and credential version, never ciphertext/token.
   Status=Draft is NOT Connected or Activated.
7. For Cloudflare DNS, Cloudflare Registrar Sandbox and Brevo, select the
   saved draft and run authorized **read-only** verification with fresh
   password+TOTP; the backend decrypts internally for one fixed-origin call,
   records a redacted audit receipt and returns non-secret evidence only.
   Other adapters remain draft-only until their own vendor readback gates.
8. Credential rotation/revocation have guarded API endpoints; do not bypass
   the established MFA flow or vendor-side key revocation. Certified Admin
   UI controls for full rotation/revocation and key recovery remain separate.

## Boundary rules
- No generic HTTP request to user-entered URL is allowed from this vault.
- Cloudflare's fixed https://api.cloudflare.com/client/v4 origin only; scoped
  account+zone owner readback. Registrar Sandbox remains read-only in Console.
- Brevo verification is a fixed GET https://api.brevo.com/v3/account, no
  email dispatch, with TLS, redirect-denial, bounded response and no account
  fields returned. It does NOT prove deliverability/domain ownership.
- OPanel, WHM and DirectAdmin credentials are stored only as inactive drafts
  until adapter-specific connection certification and provisioning security
  are separately qualified.
- Client/Staff and role-only Admin cannot enroll, save or verify provider
  credentials. Only actual active Super Admin may perform sensitive actions.
- Any missing DB migration, key, audit integrity, TOTP or custody approval
  causes failure; no fallback to plaintext settings or local disk storage.

## Live acceptance
Source build and tests are not real Production verification. Record:
1. Correct owner superuser database readback and login; second login after
   rotation/revocation as applicable.
2. PostgreSQL migrations 0002–0004 and immutable audit trigger present.
3. Real key-manager custody, distinct key identities, backup and recovery.
4. Console secure credential submission returns 201 encrypted draft,
   no secret in DB plaintext, API response, Next.js logs or browser storage.
5. Wrong role/password/TOTP, reused TOTP, SSRF endpoint and missing bootstrap
   key attempts all fail without storing credential.
6. Read-only Cloudflare and Brevo authenticated provider proofs and audit.
7. No supplier mutation / payment / DNS write; exact certified main SHA
   deployed to both Console and API; responsive Owner/Staff/Client acceptance.
