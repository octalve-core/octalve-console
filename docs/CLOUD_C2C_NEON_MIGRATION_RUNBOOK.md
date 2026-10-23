# Octalve Cloud C2C: safely initialize Neon Preview database
Date: 2026-10-23. Review-only. No production database or live-domain changes.

## Verified deployment status
- Neon `DATABASE_URL` and `DATABASE_URL_UNPOOLED` exist in Vercel API Preview.
- Django API Vercel review deployment on commit `f78384fa009b732b6d78651280917885f7123b68` is READY, following a fresh redeploy after Neon connection.
- Console's review deployment is READY. Neither READY status verifies Django migrations or real accounts.
- The Vercel Marketplace integration correctly conceals the sensitive Postgres URI from Vercel's read APIs. A separate migration runner cannot inherit it automatically.
- **Do not** create a public HTTP endpoint that runs Django migrations, and do not switch to SQLite just to get signup working.

## One-time owner configuration (protected, not in ChatGPT)
1. In Neon or Vercel's Storage integration UI, copy the **direct/unpooled**
   `DATABASE_URL_UNPOOLED` connection string for `octalve-cloud-review-db`
   (Preview only). Do not send it in messages and do not commit it.
2. In GitHub `octalve-core/octalve-console` → Settings → Environments, create
   `cloud-review-migrations`. Set deployment-branch restriction to only
   `review/cloud-portability-security-foundation`; configure required reviewer
   approval if available for this repository/plan.
3. In that GitHub Environment's secrets, create
   `CLOUD_REVIEW_DATABASE_URL_UNPOOLED` with the direct Neon connection URL.
   Never configure this as a repository-wide or Actions plaintext variable.
4. In GitHub → Actions → `Octalve Cloud — manually approved Neon review
   migrations` → Run workflow, select **review/cloud-portability-security-foundation**
   and `operation=plan`. Confirm the review preflight passes and inspect the
   actual Django migration plan. No schema changes happen in `plan`.
5. After inspecting the plan, rerun the same workflow on the same review branch
   with `operation=apply` and confirmation text
   `APPLY TO OCTALVE REVIEW ONLY`. Require environment reviewer approval.
6. Check the run's final `showmigrations --plan` and then proceed to
   browser-only signup/login against actual connected Django Preview.
7. Remove/rotate the temporary migration secret or revoke its access after
   migration if not needed for further approved review changes. Always use
   backups and a reviewable migration plan before subsequent schema changes.

## Safety boundaries
- Workflow is manual-only (`workflow_dispatch`), review branch only,
  serialized using a concurrency lock, and runs on an ephemeral GitHub runner.
- Identity/TLS preflight requires a Neon direct endpoint with TLS and rejects
  existing tables with no Django migration ledger, reducing risk of accidental
  unrelated-database modification.
- Never print database URL/password/user/hostname; do not use env dumps or
  `set -x` in CI. Checkout never persists credentials.
- This workflow is an engineering migration step, separate from the browser-only
  acceptance requirement. Playwright must not edit DBs or skip login screens.
- Never run `migrate` automatically in an API build, cold start, HTTP handler,
  or customer browser journey.
- A full persistent-data backup plan and idempotent financial settlement are
  still necessary before inviting commercial customers. Neon Free has usage
  and restore limits; a provider's point-in-time restore isn't independent backup.
