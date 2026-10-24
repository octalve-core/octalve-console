# SEC-01 clean Review database — actual infrastructure evidence (2026-10-24)

Status: PROVISIONED BUT UNMIGRATED; NOT AUTHORIZED FOR PREVIEW AUTHENTICATION OR PRODUCTION.

- Neon project: `falling-surf-50258433`
- Existing empty branch: `br-wispy-salad-b81up9oc` (`preview/review/cloud-portability-security-foundation`)
- Independent PostgreSQL database: `octalve_sec01_review`
- Dedicated owner role: `octalve_sec01_review_owner`
- Verified via authenticated SQL as the dedicated role: `current_database()=octalve_sec01_review`, zero public base tables, zero django_migrations tables.
- No Production database, schema, or branch was modified in the provisioning operation. No Neon branch was deleted.

## Safety constraints

1. This PostgreSQL database is independent but currently resides in an **old Vercel-managed Preview branch**. Do not delete that branch. Do not configure Vercel to consume this database until automatic Preview branch recreation, environment precedence and credential scope are verified.
2. The new database is intentionally EMPTY. Do NOT run SEC-01 incremental migration `accounts.0003` on it yet: first install the exact locked 48-migration/91-table baseline with Django migration executor, ensuring zero accounts and both blacklist token tables empty.
3. Existing `backend/scripts/sec01_review_schema_cli.py` allowlists previous Preview hosts and `neondb`/ `neondb_owner`. It must be updated, with negative endpoint, inherited user, token and schema tests, for this new exact database/role/verified direct endpoint before incremental apply. Do not relax its fail-closed identity checks.
4. Preview-only secrets and `DATABASE_URL` must not be copied from Production. Confirm direct, non-pooler endpoint and TLS. Never store connection strings or role passwords in repository documents.
5. Source candidate `review/cloud` commit `d26766d3804abc009f7d2c79eb0ef6ecca2cd7e8` passed both GitHub CI workflows; disposable PostgreSQL acceptance is NOT Neon Review acceptance.
6. No Production migration or PR #5/#6 release until the clean Review baseline, 49/92 after migration, browser authentication, concurrent refresh, rollback and owner acceptance are verified.

This record documents actual resources, not migration or deployment success.
