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
