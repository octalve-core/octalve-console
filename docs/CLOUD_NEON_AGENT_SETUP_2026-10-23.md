# Neon agent setup — Octalve Console foundation review
Date: 2026-10-23. Source inspection: review branch `2220b7c62001d14c7e7a3c3ef6cd4f4d2a2eaaac` before setup commit.

## Installed / preserved
- **ChatGPT Neon MCP**: already connected and confirmed operational via a read-only projects query. No reinstall, reauthentication or additional API key was necessary for this chat.
- **Project skills**: verified absent from the repository, now vendored with unchanged upstream sources into `.agents/skills/neon/SKILL.md` and `.agents/skills/neon-postgres/SKILL.md`.
- **Portable MCP client config**: `.mcp.json` points to Neon's remote OAuth MCP server, `https://mcp.neon.tech/mcp`. It contains **no token, user-specific authorization header, password or Neon API key**. VS Code's agent tooling/Copilot supports the portable root `.mcp.json`; other clients may need their own configuration.
- **Source & license**: `neondatabase/agent-skills` commit `d814689cbba1506b7a25a7a6df5346258ba8ccf8` (Apache-2.0). See `.agents/skills/LICENSE-neon-agent-skills`.
- **Preserved**: original `.gitignore`, package manifests, Django settings, Vercel environment, existing database branches and all application files. Do not change working Django auth to Neon Auth, do not run `neonctl init` again (which can mint a duplicate API key), and do not create a new Neon project.

## Local activation (Windows)
1. In your existing `octalve-console` checkout on `review/cloud-foundation-qualification`, run `git pull --ff-only`. The added files appear without package installs.
2. In a compatible editor (e.g. VS Code with an MCP-aware AI extension), enable/trust the remote Neon MCP server from the workspace `.mcp.json`. Neon OAuth authorization happens **inside that editor**; the committed URL alone does not install a local executable or log you in.
3. This **does not** modify your Windows user-wide Neon MCP settings. Your separate `neonctl auth` was already completed successfully and need not be repeated simply to activate project skill instructions.
4. To verify safely in an MCP-enabled client: list available Neon projects and confirm **only** `octalve-cloud-review-db`; use read-only branch/table queries; never initialize or modify Neon main automatically.

## Important: current migration failure is separate
Your PowerShell log showed `neonctl auth` succeeded, but `neonctl connection-string` failed with **Could not reach the Neon API**, leaving `DATABASE_URL_UNPOOLED` unset. The earlier `vercel env run` reported one secret it could not pull. Installing agent skills does **not** repair network connectivity or unlock sensitive secrets. `review_neon_migration_cli.py` correctly refused both the plan and apply operations. No migration ran.

### Safe diagnostics (do not print secrets)
```powershell
Resolve-DnsName console.neon.tech
Resolve-DnsName api.neon.tech
Test-NetConnection console.neon.tech -Port 443
Test-NetConnection api.neon.tech -Port 443
```
Network checks help differentiate local DNS/proxy restrictions from Neon CLI errors, but do not prove the CLI works.

### Fallback if Neon CLI cannot fetch the URL
In the Neon Console browser, choose `octalve-cloud-review-db` → branch `preview/review/cloud-foundation-qualification` → database `neondb` → role `neondb_owner` → **Connect** → direct/unpooled connection (disable pooling). Use only the approved direct host, never Neon main or the other preview branch. Paste a connection string only into a hidden local prompt provided by the guarded script, never chat, PowerShell command history, tracked `.env`, or PR. The guarded PowerShell script now supports `-UseNeonConsole`, which prompts for the URL with hidden input and sets it **only in the temporary migration process environment**. It never writes the connection string into Git or `.env` and restores previous environment values on exit.

```powershell
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\scripts\apply-neon-foundation-review.ps1 -UseNeonConsole -PlanOnly
# After the plan says PASS, and only with approval:
powershell -ExecutionPolicy Bypass -File .\scripts\apply-neon-foundation-review.ps1 -UseNeonConsole
```

Neon browser path: `octalve-cloud-review-db` → `preview/review/cloud-foundation-qualification` → Connect → `neondb` → `neondb_owner` → disable pooling and copy the **direct** connection URL. The URL will not be displayed when pasted into the script's prompt. **Never paste credentials into chat.**

## Scope limits
The portable `.mcp.json` is an editor/agent connection **declaration**, not proof that a Neon MCP process was installed or OAuth configured on the user's Windows computer. We cannot inspect user-wide machine configuration from this chat. ChatGPT's Neon connector is separately verified working.

No database migrations, customer accounts, live payment/hosting tasks, `main` merges or Production/DNS changes are included in this setup.
