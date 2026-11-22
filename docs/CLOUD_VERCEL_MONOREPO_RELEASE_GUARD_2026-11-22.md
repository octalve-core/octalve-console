# Octalve Cloud — Vercel monorepo Production release safety (22 November 2026)

## Incident and intended authority

The operator inadvertently ran `vercel deploy --prod --yes` from the
frontend directory before the monorepo was linked completely. The CLI
selected the existing `octalve-cloud-api` project each time, and the
output was aliased to `api.cloud.octalve.com`. A Vercel 'Ready' message
only establishes that a deployment succeeded, **not that it targeted the
correct application**.

On 22 November 2026 the operator ran `vercel link --repo` from the
existing Windows Git repository root, selected BOTH existing projects
and received the explicit confirmation:

```
✓ Linked 2 Projects under octalve-vault
```

**No new Vercel projects are to be created, and no extra local Git clones
are required.** The mapping is local, saved under Git-ignored
`.vercel/`; do not commit that directory or any `.env.local` files.
Vercel may create an OIDC identity token while linking. Do not print,
copy into chat, or commit it.

Expected verified associations:

| Repository directory | Existing Vercel project | Project ID |
|---|---|---|
| `backend` | `octalve-cloud-api` | `prj_iFSbPGawzM1peDZDYw8AnDCYBvbz` |
| `frontend` | `octalve-console` | `prj_CqAeZgrQPFXrNFFZTMnMkUhijQua` |

Organization ID: `team_048l7k9uaP1YfuEx5KaxO3dh`, Vercel scope
`octalve-vault`.

## Read-only local verification before ANY deploy

Run only from the existing checked-out Cloud Git repository:

```powershell
Set-Location (Join-Path $HOME "octalve-console")
powershell -ExecutionPolicy Bypass -File .\scripts\verify-cloud-vercel-links.ps1
```

This code checks the exact two `.vercel/repo.json` mappings, rejects
unknown/duplicate/swapped projects, checks team identity and any legacy
root `.vercel/project.json` link, and reports success or refuses. It
never calls the Vercel API or CLI, accesses secrets, changes Git or
deploys a build. CI checks both positive and negative synthetic cases.

The root `.vercel/project.json` may have a project ID that is one of
the existing two, but **it is not sufficient evidence** for the
frontend/backend mapping. That must come from `.vercel/repo.json`.

## Controlled release order

1. **Database migration is complete.** Independent Neon inspection
   confirms DNS-01C `0003` applied, 64 migrations and 117 public tables.
   Do **not** rerun migrations.
2. **Pin and review the exact intended Git commit.** The previous
   DNS-01C commit was `f275a8aee20fcff48a49c34deb529d52b2c74935`.
   A later November 21 Google Pay review commit advanced `main` to
   `5b7abdfcca42e8a9f6e0cfe376827728d2a519c0`.
   Do not silently deploy an unreviewed change, or claim same-SHA
   release on the strength of a working health endpoint.
3. Confirm the local monorepo mapping using the read-only verification
   command above. Independently check that `git status` is clean,
   Git `main` is the intended approved SHA, and the Console/API Vercel
   projects have the expected Git integrations and build root directories.
4. **Stage only the Console** on the existing `octalve-console`
   Vercel project using a pinned reviewed CLI and
   `vercel deploy --prod --skip-domain`. Use the explicit
   `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` *project IDs* in the
   local process environment if the CLI cannot unambiguously choose
   the correct project. Vercel's `--cwd` points to the
   `frontend` directory. Never use `--yes` to resolve an
   unexpected 'Which project?' prompt. Do not promote a build whose
   output shows `octalve-cloud-api` or `api.cloud.octalve.com`.
5. Inspect the staged deployment URL, target project, branch/SHA,
   security headers, login and API routing. Test authentication
   and role separation against Production, then promote that exact
   **tested** Console deployment without rebuilding. The user must
   explicitly approve any required Production promotion or rollback.
6. Verify the existing API's deployed commit and endpoint contract
   independently. The live `/api/health/` returning `status=ok`
   is a connectivity check, **not** a source-SHA or full
   application-integrity check. If the API requires a same-SHA release,
   stage it under its own distinct project before any promotion.
7. Verify current Cloudflare read-only connector custody/MFA,
   customer proof, consent, access control, revocation and
   authorized disposable-zone readback before considering feature
   flags. Both `CLOUD_DNS01_READONLY_ENABLED` and
   `CLOUD_DNS01_EXTERNAL_CLAIMS_ENABLED` must remain off by default.
   No DNS write, domain purchase, renewal or transfer is authorized.

## Recovery and prevention

If a CLI invocation reports the wrong Vercel project, **stop immediately**
and do not repeat it. Inspect the root `.vercel/repo.json` map;
run `vercel link --repo` from the repository root only if the map is
missing or wrong. Never automatically delete or recreate a Production
Vercel project and never add a domain alias while trying to fix linking.
Keep provider secrets, OIDC tokens and downloaded environment files
unpublished. Re-run the guard before every release.

References:
- https://vercel.com/docs/monorepos
- https://vercel.com/docs/cli/link
- https://vercel.com/docs/cli/deploy
- https://vercel.com/docs/cli/global-options
