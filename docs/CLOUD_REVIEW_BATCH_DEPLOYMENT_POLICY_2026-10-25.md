# Octalve Cloud — controlled batch deployment policy (2026-10-25)
Status: Review branch source-controlled setting updated; Vercel dashboard behavior still to be independently confirmed.
## Why
The prior `frontend/vercel.json` and `backend/vercel.json` allowed `review/cloud: true`, causing **two Vercel Git builds per Review commit** despite the Hobby 100-deployments-per-24h limitation. Numerous earlier Preview builds failed/quota-blocked. Continuous Review GitHub CI alone does not require a Vercel deployment.

## Finance precedent and Cloud decision
Finance `vercel.json` enables `review/**: true`, `main: true` and disables `phase/**`; changes accumulate on a non-deploying development branch, then the team promotes a reviewed batch to Review.
Cloud currently uses a permanent `review/cloud` branch for active engineering, so disable **automatic** Review deployments until the consolidated batch is ready. Keep `main: true` for approved Production promotions. No temporary branch sprawl required.

Review config in BOTH `frontend/vercel.json` and `backend/vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {"deploymentEnabled": {"main": true, "review/cloud": false, "*": false}}
}
```
No Vercel CLI deploy or Production merge performed by this change. The push that changes the setting can be interpreted by the existing Git integration before the setting is applied; verify Vercel events and project-level Build & Deployment settings.

## Workflow
1. Push source/test changes to `review/cloud`, run GitHub Actions TypeScript, Next.js, Django, security and disposable PostgreSQL tests; **no Vercel deploy for each commit**.
2. Freeze one reviewed SHA and record exact acceptance criteria, source provenance, Neon Review DB, secret scopes, migration count and security gates.
3. For Review acceptance, deliberately initiate **one Git-referenced deployment per project** via Vercel Dashboard > Deployments > Create Deployment > exact `review/cloud` commit/branch. Explicitly verify that branch-specific Preview secrets are selected. Do not use a detached local checkout/CLI to choose unknown Preview env.
4. Perform end-to-end browser/video evidence at desktop 1440, tablet 768, mobile 390, starting at home and navigating with clicks. Test auth roles, payment authority, order, invoice, CSRF, refresh/logout, isolation and error handling.
5. If failed, fix & rerun CI, then budget one explicit Review redeploy of only affected project(s) after batch; never blind repeat Vercel deployment.
6. Once SEC-01 Production migration and BIZ-01 live acceptance pass, stage separately controlled Production deployment/merge and rollback proof.

## Current status
- Oct 25 latest BIZ-01 integration: automated Django and disposable PostgreSQL tests PASS, including real checkout, invoice status and concurrent numbering; latest source commit before policy: `e7fbc398204560485b624b6da3d79061f464f54f`.
- Latest inspected Vercel commit statuses API/Console: FAILURE, not qualified live Preview; do not interpret CI green as browser acceptance.
- Review Neon remains 49 migrations / 92 tables based on prior operator evidence. Production remains 48-migration security baseline, no SEC-01 migration in Production.
- Do not merge the full `review/cloud` branch into main solely to bypass Vercel Hobby quota. `main` is still the production Git branch, and Vercel may deploy automatically when merged.
