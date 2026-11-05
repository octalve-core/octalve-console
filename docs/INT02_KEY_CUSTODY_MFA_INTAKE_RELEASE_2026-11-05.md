# Octalve Cloud INT-02 — Key custody, owner MFA and controlled credential intake

**Date:** 2026-11-05  
**Release policy:** No vendor credential submission or supplier execution until externally verified prerequisites are evidenced. Source code, UI availability, a Super Admin role, green CI, and env flags alone are not custody proof.

## Current independently verified context

- Production API and Console deployed `4403e038753bcfdf46bf90eea9605d0070fbae6c` before this PR.
- Neon `falling-surf-50258433` / default `main` `br-dark-bread-b8j0gqz4` / `neondb`: provider migrations `0002–0004` applied and `providers_event_append_only` enabled. Four provider-vault tables currently contained **zero rows** at last check.
- Existing Super Admin user ID 3 (verified email owner) is active and has the required admin, staff and superuser flags. No further promotion or email bypass is necessary.
- Verified operator-backup qualification: encrypted local custom-format PostgreSQL dump, isolated restore and migration rehearsal, independently held encrypted off-device copy. This is database schema recovery, not KMS secret recovery or provider history WORM certification.
- The Vercel API's Production environment listed **no** `CLOUD_PROVIDER_*` vars at this preflight. Thus there is no evidence of runtime vault key custody or authorized supplier credential intake.
- Resend is the approved *transactional account-email transport*, not evidence of an independently authenticated provider vault integration.

## A — Custody first; two distinct control planes

1. Select and approve an external key custody system (for example: AWS KMS protecting Fernet/HMAC envelope keys, **plus** an independently administered password-manager or encrypted recovery vault). The KMS helper in `providers/kms_custody.py` is currently an **offline primitive** with a caller-injected KMS client, not a live connected AWS role. Without an approved AWS account, IAM policy, cryptographic material and recovered evidence, do **not** assert KMS is operational.
2. Generate each key using a cryptographically secure RNG in a trusted secrets-management workflow. Use the URL-safe base64-encoded **32-byte Fernet key** form for each; `cryptography.fernet.Fernet.generate_key()` generates the correct form. Do not paste keys into ChatGPT, GitHub, issue comments, browser localStorage or CLI arguments. Never print them in CI logs.
3. The following secrets must be **mutually different** and distinct from `DJANGO_SECRET_KEY`/`ENCRYPTION_KEY`: `CLOUD_PROVIDER_VAULT_KEY`, `CLOUD_PROVIDER_STEPUP_KEY`, `CLOUD_PROVIDER_AUDIT_KEY`, `CLOUD_PROVIDER_RECOVERY_KEY`, `CLOUD_PROVIDER_CHECKPOINT_KEY`. Audit uses a 32-byte HMAC key; the same Fernet-key format is suitable, but its purpose must remain separate.
4. Store runtime copies only in protected **Vercel `octalve-cloud-api` Production** variables, never `NEXT_PUBLIC_*`. Keep independently encrypted off-device recovery material under separate custodian access; **do not** put the database archive and its decryption key in the same VeraCrypt container. Limit access to named custodians and document evidence IDs without disclosing key material.
5. Record nonsecret evidence: key IDs, algorithm, custodian role, key creation/rotation date, KMS ARN where applicable, backup location reference (not raw link or secret), restore-drill outcome, segregation-of-duty approval, two-person review. Prove a **disposable offline decryption and signature verification** against a representative encrypted snapshot. A digest or a checkbox by itself is not recovery proof.
6. If any custody or recovery evidence is missing, keep `CLOUD_PROVIDER_CUSTODY_VERIFIED=false` (or absent). This environment Boolean is only an **operator attestation**; it does not magically provision or verify custody.

### Runtime variables, all in API Production only

| Variable | First release value | Purpose |
|---|---|---|
| `CLOUD_PROVIDER_VAULT_KEY_ID` | `v1` | Identifier for active per-connection authenticated encryption key |
| `CLOUD_PROVIDER_VAULT_KEY` | secret, distinct Fernet key | Encrypt provider credential drafts |
| `CLOUD_PROVIDER_STEPUP_KEY_ID` | `v1` | Version for TOTP seed ciphertext |
| `CLOUD_PROVIDER_STEPUP_KEY` | secret, distinct Fernet key | Encrypt per-owner TOTP authenticator seed |
| `CLOUD_PROVIDER_AUDIT_KEY_ID` | `v1` | Version for HMAC signing new event receipts |
| `CLOUD_PROVIDER_AUDIT_KEY` | secret, distinct 32-byte URL-safe base64 key | Append-only audit HMAC |
| `CLOUD_PROVIDER_RECOVERY_KEY` | secret, distinct Fernet key | Offline encrypted snapshot qualification only |
| `CLOUD_PROVIDER_CHECKPOINT_KEY` | secret, distinct Fernet key | Separately signed audit checkpoint |
| `CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON` | empty | Old vault decryption keys for offline rollover |
| `CLOUD_PROVIDER_STEPUP_PREVIOUS_KEYS_JSON` | empty | Previous versioned TOTP decryption keys |
| `CLOUD_PROVIDER_AUDIT_PREVIOUS_KEYS_JSON` | empty | Previous audit HMAC keys to verify historic immutable events |
| `CLOUD_PROVIDER_CUSTODY_VERIFIED` | `false` until evidence | Operator attestation; never sufficient by itself |
| `CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED` | `false` until A passes | Genuine owner authenticator enrollment |
| `CLOUD_PROVIDER_ALLOWED_DRAFT_ADAPTERS` | empty | Default-deny individual provider credential intake |
| `CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED` | `false` | Global vault mutation gate |
| `CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED` | `false` | Separate explicit Production approval |
| `CLOUD_SUPPLIER_PINNED_READBACK_ENABLED` | `false` | Strictly controlled read-only supplier egress |
| `CLOUD_PROVIDER_VAULT_REWRAP_ENABLED` | `false` | Offline key rotation apply gate |
| `CLOUD_PROVIDER_STEPUP_REWRAP_ENABLED` | `false` | Offline TOTP key rotation apply gate |

Set each key name **once** in Vercel Production. Never create duplicate entries targeting the same environment. Changing a variable requires a fresh approved Production deployment.

## B — Genuine owner TOTP enrollment before credential intake

Only after A has separate off-device recovery and successful isolated decrypt/recovery verification:

1. Keep credential writes, supplier egress and Production vault approval disabled.
2. Set `CLOUD_PROVIDER_CUSTODY_VERIFIED=true` and `CLOUD_PROVIDER_STEPUP_ENROLLMENT_ENABLED=true` in API Production; deploy the approved main commit. Leave `CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=false`, `CLOUD_PROVIDER_ALLOWED_DRAFT_ADAPTERS` empty.
3. In **Admin → Settings → Security → Provider-vault authenticator**, sign in as the verified Super Admin. Enter your current Console account password. The server returns a fresh 160-bit TOTP seed in memory over the authenticated Console proxy, encrypted at rest in Neon under a *separately held* key. A pending enrollment expires after five minutes.
4. Enter the seed into an authenticator app that supports RFC 6238 TOTP. Enter a fresh six-digit code and the account password. Confirmation stores `verified=true` and the accepted `last_counter`, preventing TOTP replay. The authenticator seed must not be emailed, pasted into chat, stored in browser localStorage or included in screenshots.
5. Confirm the Security status shows verified. Verify directly (without revealing encrypted seed) that a *single* authenticator exists for the intended owner; unsuccessful, expired, unverified-role, invalid-password and reused-code attempts fail. Revoke/recovery of a lost authenticator requires independently approved owner recovery; **never** delete or backfill MFA rows via SQL to bypass.
6. Disable new enrollments after confirmation if no further owner enrollment is approved. Existing verified MFA remains valid for credential mutations; enrollment-enabled is not a prerequisite for future authenticated actions.

TOTP alone is not phishing-resistant. Future WebAuthn/security-key support should be considered, especially for high-risk credential actions.

## C — Independent production security acceptance before any adapter is enabled

- Confirm exact Production Vercel API `DATABASE_URL` points to independently verified Neon `main`; no Preview, branch drift or foreign database.
- Recheck migrations `0002–0004`, the **enabled** PostgreSQL append-only event trigger, no writable event rewrite path, secret-redacted API responses and accurate owner role.
- Run deny-role tests (anonymous, client, staff, non-Super Admin, unverified admin), wrong password, expired and replayed TOTP, missing/duplicate/wrong keys, broken audit chain, wrong owner, tampered ciphertext, disabled/absent database trigger and unusable external recovery.
- Prove supplier outbound traffic is default-deny (pinned public IP, exact hostname, HTTPS cert+hostname validation, allowlisted method/path/header, bounded body size, no redirects, no arbitrary URL, no credential-bearing logs); `CLOUD_SUPPLIER_PINNED_READBACK_ENABLED=false` by default and no supplier purchasing/provisioning code from this gate.
- Require nonsecret external approval receipts and an **isolated coherent recovery** containing cryptographically valid signed events and encrypted credential versions, plus independent immutable audit checkpoint retention. Synthetic CI success alone is not sufficient Production evidence.

## D — Controlled, one-provider-at-a-time encrypted draft intake

After A/B/C **and** separate approval for one adapter:

1. Set `CLOUD_PROVIDER_ALLOWED_DRAFT_ADAPTERS` to a single exact known adapter key, e.g. `cloudflare-dns` *only after its permission contract and provider readback have been reviewed*. An empty or malformed allowlist rejects all Production credential creations and rotations.
2. Set `CLOUD_PROVIDER_PRODUCTION_VAULT_APPROVED=true`, `CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=true` under a documented operator change window. Retain other provider execution/provisioning flags OFF.
3. Deploy exact reviewed `main`, recheck API status says `approved_draft_adapters` contains that provider; only a verified owner with password + a fresh, unused TOTP can create encrypted drafts.
4. Use minimally privileged provider **test-only** credentials first, verify ciphertext never appears in an HTTP response, browser storage, query string, error or log; verify event HMAC and append-only DB trigger and independent snapshot recovery. Require separate certification before any live vendor readback or mutation.
5. If any gate fails, set `CLOUD_PROVIDER_CONNECTION_WRITES_ENABLED=false`, redeploy and preserve forensic evidence; do not delete audit events or reset owner verification.

## Key rotation and tested recovery

- **Vault:** retain `CLOUD_PROVIDER_VAULT_PREVIOUS_KEYS_JSON` with encrypted, protected previous Fernet key versions until offline `rewrap_provider_vault` dry-run + explicitly approved apply + independent recovery pass, then remove old keys only when no row uses them.
- **TOTP:** the new ciphertext envelope stores `v1.<fernet-token>` (legacy pre-version tokens map to v1). Rotate using `CLOUD_PROVIDER_STEPUP_KEY_ID=v2`, a new distinct `CLOUD_PROVIDER_STEPUP_KEY`, and a protected `CLOUD_PROVIDER_STEPUP_PREVIOUS_KEYS_JSON` containing v1. Run `python manage.py rewrap_provider_stepup` (dry-run). Only with fresh encrypted off-device backup and separate approval set `CLOUD_PROVIDER_STEPUP_REWRAP_ENABLED=true` and use `--apply --confirm REWRAP-PROVIDER-STEPUP`. Then verify the new key without old key in an isolated recovery drill; only then retire v1.
- **Audit:** set a new `CLOUD_PROVIDER_AUDIT_KEY` and `CLOUD_PROVIDER_AUDIT_KEY_ID`, retain all historical keys in `CLOUD_PROVIDER_AUDIT_PREVIOUS_KEYS_JSON`. Each immutable historical event is authenticated against the bounded keyring; new events use the active key. **Do not remove historic keys while their signed events remain**. No mutation of signed events or deletion to make verification succeed. A new audit history epoch with independent checkpoint is future architecture, not claimed here.
- The prior-key rings are capped at eight entries; an invalid, missing, reused or corrupt prior key fails closed.

## Acceptance ownership and current gate

| Gate | Current independently evidenced result |
|---|---|
| Provider schema and immutable event trigger | Verified Production |
| Verified owner email and account identity | Verified Production |
| Resend transactional delivery | Confirmed by owner signed email verification |
| External vault/TOTP/audit key material in approved independent escrow | **Not yet evidenced — BLOCKED** |
| MFA registered and replay-tested for the owner | **Not yet evidenced — BLOCKED** |
| Coherent live encrypted credential/audit recovery with immutable external checkpoint | **Not yet evidenced — BLOCKED** |
| Per-provider credential intake | **OFF; no approved adapter** |
| Supplier execution and purchasing | **OFF** |

References: OWASP Secrets Management Cheat Sheet; OWASP Multifactor Authentication Cheat Sheet; NIST SP 800-63B-4 (2025); PostgreSQL 18 transactional integrity and role access.
