# Privileged Console WebAuthn

The privileged WebAuthn requirement defaults off. This branch implements the password-to-passkey login exchange, credential and single-use challenge persistence, assurance checks on privileged access and refresh, and a closed boundary around Django admin and Django REST Framework session login when enforcement is enabled.

The Console origin is https://console.cloud.octalve.com and the relying party ID is console.cloud.octalve.com. The browser and verifier require user verification. The backend issues a privileged JWT only after the pinned verifier checks the assertion and updates the credential counter. The signed token identifies its credential and stops working if that credential is revoked. No passkey private key is stored.

## Enrollment and recovery

A deployment operator with an independently approved identity and change reference uses the Django management command `issue_privileged_passkey_grant` with `--account-id`, `--approval-reference`, and `--confirm-independent-approval`. Use `--recovery` only for an approved lost-credential recovery. Approval is an operational control and the command records its reference. It cannot verify the external approval workflow.

Deliver the 15-minute setup code over the approved private channel. The operator visits `/login?passkey=setup` on the canonical Console and provides the code and their current account password to complete the browser ceremony. Store no codes in tickets, chat, CI logs or database plaintext. A new grant invalidates unused earlier grants. Recovery changes old credentials and token revocation only after a valid replacement credential is registered. Issue a separate normal grant for each backup authenticator.

## Production activation gate

Both `CLOUD_PRIVILEGED_PASSKEY_ENROLLMENT_ENABLED` and `CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED` default off.

1. Confirm the database identity, obtain the migration approvals and verify backup and recovery, then apply the additive credential, challenge and enrollment grant migrations.
2. Enable enrollment only. Use independent authorization to enroll the primary and backup authenticators of each privileged operator. Confirm loss recovery and prior credential and JWT revocation on a dedicated test account.
3. Verify the actual browser ceremonies, negative origin and replay handling, and ordinary client login. Schedule cleanup of expired grants and challenges and verify retention of the audit records and approved recovery notifications.
4. Enable mandatory sign-in only after privileged operators are enrolled and the recovery process is proven. Decide whether to keep raw Django admin and DRF session login disabled or qualify a separate passkey flow for them. Under enforcement this code blocks them.

Fixture verifiers and default-disabled deployment do not establish browser or operator readiness. Do not insert production credential public keys manually as a substitute for enrollment.


## AUTH-01 hardening and qualification

- Mandatory enforcement remains default-off. Enrollment-only mode supports explicit sign-in at `/login?passkey=verify` for privileged accounts, using password plus an enrolled authenticator. The API never falls back to password-only on that request; the BFF requires the server's verification confirmation before setting cookies. Normal sign-in is unchanged until enforcement is enabled.
- Basic and Django session authentication cannot satisfy mandatory privileged MFA. Passkey-bound JWTs are checked against active credentials even when enforcement is subsequently disabled. Recovery re-salts the verified current password (without changing its value), invalidating previous Django sessions and password-reset links; tracked JWT families are blacklisted. Untracked legacy bearer tokens must be allowed to expire before declaring full revocation (access lifetime 60 minutes).
- Register a genuinely separate backup authenticator, not merely another device synced to the same passkey. Enrollment excludes previously registered credential IDs. Test primary and backup independently; after recovery enroll a new backup.
- Independently verify identity and change approval outside the management command. Record only the approval reference and safe evidence (account ID, credential count, event timestamps, response status); never capture setup codes, passwords, JWTs, cookies, or raw credential evidence. Send enrollment/recovery notifications over the approved independent channel and record delivery. No automatic mail is implied.
- During enrollment-only mode password-only privileged login is deliberately still available; recovery revokes previous sessions but does not prohibit a new password login. Mandatory enforcement is a separate owner-approved operation.
- Read the [protected production release runbook](CLOUD_PRODUCTION_RELEASE_RUNBOOK_2026-10-26.md) for backup, environment identity, staging and rollback policy. From the existing local checkout use `git fetch origin`, inspect a clean worktree, `git switch main`, then `git pull --ff-only origin main`. Verify the approved SHA before connecting to Production. Run `showmigrations accounts`, `migrate accounts 0005 --plan`, `sqlmigrate accounts 0004` and `sqlmigrate accounts 0005` with the verified Production environment; do not print secrets. Stop if the plan differs from exactly the two additive migrations or if backup/restore is unqualified. Only after owner approval run `python manage.py migrate accounts 0005 --noinput`. Never run tests against Production.
- Retain audit events, expire grants/challenges on schedule under the approved retention policy, and qualify individual credential management separately. No database downgrade is required for a compatible flag rollback. Disabling enforcement is a security downgrade requiring owner approval; keep passkey credential validation active and do not roll back to a build that lacks that validation if passkey sessions have been issued.
