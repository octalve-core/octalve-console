# Privileged Console WebAuthn

The privileged WebAuthn requirement defaults off. This branch implements the password-to-passkey login exchange, credential and single-use challenge persistence, assurance checks on privileged access and refresh, and a closed boundary around Django admin and Django REST Framework session login when enforcement is enabled.

The Console origin is https://console.cloud.octalve.com and the relying party ID is console.cloud.octalve.com. The browser and verifier require user verification. The backend issues a privileged JWT only after the pinned verifier checks the assertion and updates the credential counter. The signed token identifies its credential and stops working if that credential is revoked. No passkey private key is stored.

## Production activation gate

Keep CLOUD_PRIVILEGED_WEBAUTHN_REQUIRED off until all of the following have evidence.

1. Add an authorized enrollment ceremony that validates the attestation against a durable, user-bound challenge. Initial enrollment must be independently authorized. A password, email reset, or existing unqualified Django session alone cannot enroll a privileged credential.
2. Enroll and verify the designated privileged operators with primary and backup authenticators. Exercise recovery with independent approval and prior session revocation.
3. Obtain migration preflight and backup approval for the credential and challenge tables. Schedule cleanup of expired challenges, and establish enrollment, use and revocation audit retention.
4. Qualify the real browser ceremony, failed and cancelled assertions, cross-origin and replay rejection, concurrent submissions, and lost-key recovery using ordinary and privileged fixtures.
5. Decide whether the separate Django admin and DRF session login routes should stay disabled or receive their own qualified passkey flow. Under enforcement the current boundary refuses them.

Test fixtures and the default-disabled branch do not establish operational readiness. Do not manually insert credential public keys as a production enrollment shortcut.
