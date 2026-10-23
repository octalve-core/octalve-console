# Foundation Preview — Neon migration acceptance

Review source branch: `review/cloud-foundation-qualification`. Canonical production `main` remains untouched.

## Verified
- Frontend Next.js, Django and security regression CI passed at `3f52878177919fedd66b3d9ab2af71053c05d008`.
- The API and Console were redeployed on Vercel using **Preview-only, branch-scoped** environment values.
- Neon `DATABASE_URL` and `DATABASE_URL_UNPOOLED` exist in the API Preview environment; presence does not prove migrations applied.
- The public Cloud homepage's published `Get Started` points to `https://console.octalve.cloud`. The browser clicks it but cannot reach a usable login. That domain needs an approved valid redirect/destination.

## The actual Neon schema is not yet verified
Do not assume the `django_migrations` ledger exists or that registration will work simply because Vercel says READY.

One-time restricted operator procedure:
1. In Neon, retrieve the `octalve-cloud-review-db` **direct/unpooled** connection string for the Preview database. Do not paste it into chat, PR comments or code.
2. In GitHub `octalve-core/octalve-console` → Settings → Secrets and variables → Codespaces, create `CLOUD_REVIEW_DATABASE_URL_UNPOOLED` limited to this repository. Verify the selected DB project/branch is exclusively the Cloud review database.
3. Create a Codespace from branch `review/cloud-foundation-qualification`.
4. Run `bash backend/scripts/run_review_migrations.sh plan`. Review all planned schema migrations.
5. **Only with explicit approval of the displayed plan**, run `bash backend/scripts/run_review_migrations.sh apply` and type the confirmation phrase when prompted.
6. Preserve the result log with secrets redacted and verify registration through an actual browser, not direct API injection.
7. Disable/delete temporary Codespace and restrict or rotate the migration secret when finished.

The script requires an exact clean review branch and a TLS-protected unpooled Neon connection. It refuses non-Neon targets or production jobs. This is a one-time engineering operation, independent of normal Vercel Git Preview auto builds.

## Qualifying the browser flow
The current public domain cannot complete Cloud → Console without an approved destination. After normal login is accessible and browser acceptance passes, map `console.cloud.octalve.com` to the reviewed Console deployment and redirect the existing `console.octalve.cloud` navigation alias. Preserve cookies/paths and test mobile/desktop. **Do not connect DNS or merge without owner approval.**

## Release gates
- No payment acceptance or host provisioning until atomic settlement and idempotent audited worker.
- Non-production database never reused for real customer finance/hosting data.
- Independent pilot production database, encrypted backups, secrets, mail delivery, access policies and Vercel plan eligibility before any external pilot.
- `main` remains a qualified release; PR #3 is not safe to promote on CI alone.
