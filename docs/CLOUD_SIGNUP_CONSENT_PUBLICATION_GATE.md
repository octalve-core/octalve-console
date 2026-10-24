# Signup legal-consent acceptance
Review-only change for Octalve Console. On the account-creation form, `acceptedTerms` now defaults to `false`, requiring the user to actively select the checkbox. The submit handler already rejects unchecked submissions; no new identity flow was introduced.

This does **not** validate the legal texts. The intended linked URLs are:
- https://cloud.octalve.com/terms-of-service
- https://cloud.octalve.com/privacy-policy

As of the source inspection on 2026-10-23, the public Cloud website has *generator tools* for policies but does **not** implement these two Octalve Cloud company policy routes. The generator pages are not a substitute for actual approved company policies. Do not invite external pilot registrations until the owner/legal reviewer has approved and published the real terms and privacy notice.

Separate UX acceptance: open Signup through visible Console navigation, verify the terms checkbox is initially unchecked, and verify unchecked submission is blocked. Protected preview prevents this browser test until authorized access is configured.
