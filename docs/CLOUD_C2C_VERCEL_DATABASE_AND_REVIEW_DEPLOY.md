# Octalve Cloud C2C — Vercel review deployment and database requirement
Date: 2026-10-23. **Review only.** No main branch or DNS modified.

## Verified Vercel project state
- `octalve-console` is a real Vercel project; its **main** deployment from `d7937e9` is READY at https://octalve-console.vercel.app/login.
- `octalve-cloud-api` is a separate real Django Vercel project; its initial main build failed because DJANGO_SECRET_KEY was missing.
- Review branch `review/cloud-portability-security-foundation` has passed frontend, Django and security CI at commit `e3869595496244dd0d7f9715c987704958565f4e`.
- Vercel **Preview-only, branch-scoped** settings now contain a generated Django signing key and independent encryption key. Never store or print secrets in a commit or logs.
- The first reviewed Django build after those settings passed secret-key validation, then failed when no database had been attached: DB_NAME was absent. This commit intentionally makes the Vercel-specific failure message actionable: a real DATABASE_URL is REQUIRED, rather than falling back to production's legacy MySQL settings.
- Vercel runs builds from the target Git ref. Do not promote the review branch or associate its untested API with api.cloud.octalve.com.

## Persistent PostgreSQL dependency
The connected Vercel team has a **Prisma Postgres** Marketplace integration installed; no Postgres resource is currently associated with `octalve-cloud-api`.
1. In Vercel's intended team, open **Storage → Create Database → Prisma Postgres**. Choose a separate review/development database with the approved **Free** plan and appropriate region. Inspect pricing, terms, limits and backups before committing.
2. Link the database **only to octalve-cloud-api's Preview environment**. Do not connect it to Production/Development by default or reuse another Octalve product's database.
3. The Prisma integration injects `DATABASE_URL` (also POSTGRES_URL and PRISMA_DATABASE_URL) into the selected project environment. Confirm the *key exists* without displaying its value. Django's `environ.Env.db("DATABASE_URL")` works with the standard Postgres URI (not a Prisma-specific ORM requirement).
4. If multiple preview branches exist, isolate the database credentials by branch and do not assume that the Preview target provides per-branch separation. Vercel project environment variables are only available to deployments built **after** they are created/changed.
5. Run **reviewed Django migrations separately**, against exactly this isolated database; no migrations are allowed from HTTP requests or the application startup. Use a controlled ephemeral management runner with a short-lived, least-privilege DB credential. This is engineering setup and is never part of the required browser-only customer walkthrough.
6. Check readiness with real browser account registration/login, persistence across redeploy and negative tenant permission tests. Liveness `/api/health/` proves only that code responds.
7. For future request concurrency, avoid the low direct-connection cap of Prisma's free tier; obtain the **pooled** Postgres endpoint. Never confuse pooled URLs with migration credentials.

Official provider documentation: https://www.prisma.io/docs/guides/postgres/vercel

## Exact site bindings (planned; no production DNS change)
- Public: https://cloud.octalve.com
- Console: https://console.cloud.octalve.com
- API: https://api.cloud.octalve.com
- OPanel: https://opanel.cloud.octalve.com
- Review Console uses the reviewed API **Preview branch alias**, not the broken main alias. Django CORS/CSRF origins must match the exact reviewed Console URL.
- Current Vercel Hobby plan's non-commercial terms must be assessed before using it for Octalve commercial operations.
