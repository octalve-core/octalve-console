# Octalve Cloud — PostgreSQL auth schema evidence & acceptance gate

**Date:** 2026-10-23
**Status:** PostgreSQL CI qualification **passed**; browser and Review Neon migration **not approved**.
**Branch:** `review/cloud-auth-token-lifecycle` (draft PR #4, based on PR #3).
**Evidence commit:** `417623e4ee0d2a131a9b022e0c3c50697be3f945`.
**Isolated PostgreSQL CI run:** https://github.com/octalve-core/octalve-console/actions/runs/40001150518
**Regular CI run:** https://github.com/octalve-core/octalve-console/actions/runs/40001150385

## Exact schema authority

The full revised candidate is
`CLOUD_FOUNDATION_AUTH_BLACKLIST_INITIAL_MIGRATION_CANDIDATE_2026-10-23.md`.
48 migrations, 217 operations. SHA-256 of complete UTF-8 transcript:
`516cd378502964020838c5d23b89caf172bd1cf135677172ee85e4795892a8cd`.

This is the immutable 36/200 foundation plan plus 12 built-in SimpleJWT
blacklist migrations and 17 operations. The previous 36/200 guarded Neon
runner continues to reject the revised plan. Do not change that runner or
use its original approval phrase to authorize the new schema.

## What we executed on disposable GitHub Actions PostgreSQL only

- Confirmed local-only `octalve_auth_ci` target and `octalve_ci` user.
- Confirmed no initial `django_migrations` ledger.
- Independently reproduced exactly the locked 48/217 plan fingerprint using
  the PostgreSQL Django backend, not SQLite.
- Applied all 48 migrations successfully to this temporary PostgreSQL service,
  **not any Neon or Production branch**.
- Verified exactly **48 ledger records**, **12 token_blacklist migrations**,
  and **91 public tables**.
- Verified `token_blacklist_outstandingtoken`,
  `token_blacklist_blacklistedtoken`, and `accounts_customuser` exist.
- Verified 6 constraints across the two blacklist tables, including:
  outstanding-token JTI unique; blacklist-token one-to-one unique;
  foreign keys to outstanding tokens and users; and primary keys.
- Passed **16 Django API regression tests** against PostgreSQL, including
  signup privilege denial, login, rotation, used-token rejection, logout
  blacklist, missing refresh and cross-account revocation denial.
- Rendered PostgreSQL `sqlmigrate` for all **12** built-in blacklist
  migrations with **zero SQL rendering errors**. These outputs are
  *illustrative* and may depend on the migration state/database connection.

## PostgreSQL SQL and reversible-operation observations

The blacklist migrations contain table creation, FK/unique constraints,
the staged `jti_hex` conversion, indexed uniqueness, column changes,
and 32-bit-to-64-bit identifier alterations. The critical observed
constraints are:

- `token_blacklist_outstandingtoken_jti_hex_d9bdf6f7_uniq`: UNIQUE (jti)
- `token_blacklist_blacklistedtoken_token_id_key`: UNIQUE (token_id)
- `token_blacklist_blacklistedtoken_token_id_3cc7fe56_fk`: foreign key
  to the outstanding-token table.
- `token_blacklist_outs_user_id_83bc629a_fk_accounts_`: foreign key to
  `accounts_customuser`, with nullable user semantics.

The vendor's `0003_auto_20171017_2007` migration is a **RunPython** data
conversion of UUID JTI to hex, and has no printed SQL in `sqlmigrate`;
inspect that vendor implementation when assessing rollback. This CI
database was empty initially, so no existing customer token data needed
conversion. In a populated deployment the migration may require additional
locking/transaction and live-data analysis.

Django's official `sqlmigrate` documentation notes that SQL generation
uses a database connection and can require a matching database copy.

## Recovery reality on Neon

Target Foundation Review branch `br-wild-field-b88w1xq5` and separate
auth Review branch `br-winter-bar-b87tjg9h` are **child branches** of
`main`. Do **not** assume root-branch PITR can reset a child branch.
The Foundation Review's existing recovery branch is
`br-odd-hat-b871exkh` (pre-Django schema). Before applying to auth
Review, create and independently verify a recovery child branch for that
specific target. Confirm target host, DB, user, zero application tables
and client TLS **again** immediately before any migration. Review the
Neon restore/branch-switch recovery process; never reset `main`.

## Outstanding browser and operational acceptance blockers

1. **Token coherence:** `frontend/src/proxy.ts` can refresh/rotate the
   HTTP-only refresh cookie via the backend, while `AuthContext.tsx`
   and `frontend/src/lib/api/client.ts` retain old access/refresh tokens
   in `sessionStorage`. On protected-page reload/expired access this
   may cause inconsistent state and failed API calls. Design a single
   session authority and test rotation with a real browser; do **not**
   patch this with a blind re-issuance or weakened blacklist.
2. **Logout semantics:** blacklisting revokes the refresh token, but an
   existing signed access JWT can remain valid for up to its configured
   60-minute lifetime; claims of immediate total revocation are wrong.
3. **Legal consent:** signup checkbox is frontend-only until server-side
   acceptance evidence and published terms/privacy routes are qualified.
4. **Preview access:** authorized Vercel protection and CORS preflights,
   actual API/Console Preview credentials and browser tests are still needed.
5. **Operations:** define and schedule bounded `flushexpiredtokens`
   cleanup after deployment, with job ownership and failure monitoring.
6. **Authority:** independently approve *new* 48/217 plan and separately
   authorize Neon Review schema application. No merge to `main` or
   Production promotion before end-to-end acceptance.

## Decision

**PASS:** revised migration plan, disposable PostgreSQL forward migration,
schema inventory, blacklist constraint verification, API regression tests.

**NOT YET PASS:** real Neon Review initial migration, persistent Preview
signup/login/refresh/logout, cross-browser/session lifecycle, published
legal consent, Production release qualification.

No Neon, Vercel Production, DNS, payments or hosting provisioning changes
were made by this PostgreSQL qualification step.
