# One-command Windows migration — Vercel Preview secrets, no Codespaces
This is for the **approved initial 36 Django migrations only**, on:
- Project: `octalve-cloud-review-db` (Neon ID `falling-surf-50258433`)
- Neon branch: `preview/review/cloud-foundation-qualification` (`br-wild-field-b88w1xq5`)
- Database: `neondb`
- Direct connection host: `ep-damp-morning-b8ll84zq.c-14.us-east-1.aws.neon.tech`
- Source: foundation review branch PR #3; plan SHA-256 `80b1813003a779ffb314085caec5402cafb7cc96dd87cb1c7cbde1f154e57a20`
- Neon recovery child branch created before migration: `backup/pre-django-initial-schema-2026-10-23` (`br-odd-hat-b871exkh`).

## Why this exists
An external cloud sandbox cannot access Neon/Vercel sensitive DB credentials automatically; attempting to copy the secret between remote tool contexts was blocked. GitHub Codespaces setup is confusing. Vercel's officially documented `vercel env run -e preview --git-branch ... -- <command>` supplies the branch's existing Preview variables to a **local one-off process without writing a .env file**. This still requires the owner's normal login on their own Windows computer; there is no secure unrestricted remote credential bypass.

## Steps (no database password to copy)
1. On your own computer, open PowerShell in the existing `octalve-console` checkout and switch to the latest `review/cloud-foundation-qualification` branch. Keep your worktree clean. Have Python 3.12, Node.js and Git installed.
2. First run `powershell -ExecutionPolicy Bypass -File .\scripts\apply-neon-foundation-review.ps1 -PlanOnly`.
3. If plan verification passes, run `powershell -ExecutionPolicy Bypass -File .\scripts\apply-neon-foundation-review.ps1`. Type `APPLY 36 MIGRATIONS TO FOUNDATION PREVIEW` only after seeing the preflight.
4. The Python runner fails closed if the **exact** Neon endpoint/DB/role, TLS, empty schema, operation counts or SHA-256 differs. It must not be rerun on an initialized database.
5. Do not put DB passwords in chat, terminals, PR comments or scripts. Do not ever run this against Vercel Production or Neon main.

## Security notes
The script inherits existing protected Preview credentials through Vercel CLI. It does not print the connection URL. The password does pass into the local process environment for the duration of the command; run only on a trusted personal workstation, never a shared computer. The CLI may require normal Vercel authorization/login. Vercel CLI link writes a local ignored `.vercel` project association, not source code.

This run does not merge, change DNS, bypass Vercel protection or enable live commercial features. After application, return to Neon read-only ledger verification before any real browser registration.
