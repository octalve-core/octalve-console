# Octalve Cloud — review-only JWT lifecycle and schema amendment

Status: **DRAFT. No Neon migration approval.**

## Baseline and isolation

Source parent: `121130bc86f3947aad8eefbe82e08dd93e625695`.
The reviewed Neon Preview plan remains 36 migrations and 200 operations,
fingerprinted with SHA-256 `80b1813003a779ffb314085caec5402cafb7cc96dd87cb1c7cbde1f154e57a20`.
That plan applies ONLY to the previous source revision. Do not execute it
after changing the INSTALLED_APPS migration graph.

## Review-only code changes

- Enable SimpleJWT 5.5.1 database-backed token blacklist models.
- Delegate refresh to the pinned SimpleJWT TokenRefreshView, including
  configured ROTATE_REFRESH_TOKENS and BLACKLIST_AFTER_ROTATION behavior.
- Send the refresh token on logout and verify its owner before revocation.
- Return an error rather than falsely claiming revocation if refresh is
  missing, expired or belongs to a different account.
- Keep browser-local cleanup even when the API cannot revoke a token.
- Add isolated-Django regression tests for rotation, replay, logout and
  cross-account revocation.

## Outstanding qualification gates

1. Create a complete revised initial Django migration plan on an isolated
   disposable database, review the full schema operation and SQL diff, and
   independently approve the new migration count and fingerprint.
2. Update the guarded Review runner ONLY after the revised plan is reviewed.
   It must continue to reject nonempty schemas, wrong host/DB/role, missing
   client TLS and missing explicit authorization.
3. Execute complete Django/CI frontend tests and dedicated API token tests.
4. Test legitimate Preview signup, login, logout, token replay and
   session behavior in a real browser.
5. Access JWTs remain usable until their current one-hour expiration even
   after refresh revocation; immediate access-token revocation would need
   a separately accepted design. Do not overstate logout scope.
6. Do not merge to main, configure Production, launch payments, or enable
   provisioning as part of this draft.

References: SimpleJWT 5.5.1 Blacklist app and Settings documentation.
