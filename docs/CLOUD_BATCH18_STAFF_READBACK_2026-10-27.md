# Octalve Cloud — Batch 18.1 Staff Management Read-Only Foundation

Date: 27 October 2026
Base: main dfbec82de36a7d08665f9060b73fbf612c52af17.

## Implemented
- Reuse existing CustomUser and StaffProfile; no new staff table or database migration.
- GET /api/auth/staff/ is authenticated Admin-only, never open to Staff or Clients, includes disabled accounts, read-only and capped to 50 rows plus truncated flag.
- Explicitly exclude password hashes, personal phone, private staff notes, signatures, referral codes, tokens and security metadata. No role/privilege/lock changes.
- BFF allows exactly GET /auth/staff/; POST/PATCH/PUT/DELETE are rejected. HttpOnly session and actual Django role checks remain authoritative.
- Admin Team directory and existing details now display actual staff name/email/department/status through the BFF. No false invitation/edit actions, no fake data.
- Tests: cross-role denial, anonymous denial, redaction, disallowed writes, disabled account visibility and unchanged status. Add CI source contract.

## Still required for full Batch 18
Explicitly authorized staff invitation and identity verification, least-privilege RBAC, MFA enrolment/recovery, separation of duties, role change approval, audited disable/session revocation and accessible challenge process.
Blacklist/risk rules need separately reviewed versioning, expiry, narrowly scoped enforcement, anti-lockout fallback, appeal and false-positive reversal. No global IP/email denial rule is enabled here.
Authenticated browser parity and Production deployment proof remain blocked by Vercel build limits. Source CI green alone is not full external acceptance.
