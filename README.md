> **CURRENT EXECUTION INDEX — 26 OCTOBER 2026 (Review only).** The authoritative implementation and Production plan is [Cloud Master Execution](docs/CLOUD_MASTER_EXECUTION_PLAN_2026-10-26.md), with [Acceptance Matrix](docs/CLOUD_MASTER_ACCEPTANCE_MATRIX_2026-10-26.md) and [Protected Release Runbook](docs/CLOUD_PRODUCTION_RELEASE_RUNBOOK_2026-10-26.md). Console [PR #13](https://github.com/octalve-core/octalve-console/pull/13) and [PR #14](https://github.com/octalve-core/octalve-console/pull/14) remain **draft and unmerged**; independent OPanel [PR #1](https://github.com/octalve-core/octalve-opanel/pull/1) is also draft. Existing financial/provisioning actions are default disabled, external hosting/domain/WordPress operations are **NOT live-qualified**, and automated CI does **not** constitute Production acceptance. Prior Production DB counts (including older 48/91 and later reported 49/92) are historical snapshots, **not** a current verified migration ledger. The original MVP/readme material below is historical and should not be used as an authentication, payment, migration, or Production execution guide.

# Octalve Console — Premium MVP Package

Octalve Console is a hosting business operating system inspired by the operational depth of WHMCS, Blesta and Paymenter, with cleaner product UX patterns similar to Hostinger, Namecheap and GoDaddy.

This package contains:

```txt
octalve-console/
  frontend/    Next.js 14 premium interface
  backend/     Django backend architecture skeleton
  docs/        implementation, adapter and roadmap documentation
```

## Quick start

```powershell
cd "C:\Users\Bi Creativity\octalve-console"
pnpm install
pnpm dev:frontend
```

Open:

```txt
http://localhost:3000/login
```

For this MVP, the login form is frontend-only and redirects into the console. Use any email and password while the real Django authentication is being connected.

## What has been built

- Admin console shell with premium sidebar, topbar, cards, tables, editors and detail pages.
- Client portal shell with order flow, service management, DNS/file/usage/backup/VPS/migration areas, invoices, wallet, support and knowledge base.
- Staff workspace shell for support, customers, provisioning, security and knowledge base.
- Product, plan and package management screens.
- Gateway configuration screens for Paystack, Flutterwave, Cryptocurrency, Bank Transfer, Wallet Balance and Manual Payment.
- Provider adapter UI and backend adapter architecture for DirectAdmin, cPanel, Plesk, Proxmox, Virtualizor, Enhance, Pterodactyl, VirtFusion, Cloudflare, domain registrars, SSL providers, email providers and backup providers.
- Billing screens for invoices, transactions, services, quotes, domains, print queue and batch processing.
- Tools: service queue, currency converter, mass mailer, blacklist, download manager, CMS, utilities.
- Support screens: tickets, departments, predefined responses, support staff and knowledge base.
- Settings foundation: general, security, social login, tax, mail, tickets, cron, credits, theme, invoices, API keys, notifications and providers.

## Current technical status

The frontend is a complete premium MVP interface using shared data in:

```txt
frontend/src/lib/platform-data.ts
```

The backend folder is a Django architecture skeleton. It defines the future backend shape, adapter contracts and service boundaries, but it is not yet connected to the frontend.

## Next implementation phase

1. Connect login/signup to Django authentication.
2. Replace `platform-data.ts` with API calls.
3. Implement PostgreSQL models for users, customers, products, plans, orders, invoices, services, domains, wallets, tickets and audit logs.
4. Build the adapter executor that provisions services through DirectAdmin first.
5. Connect Paystack and Flutterwave payment initialization and webhooks.
6. Build cron jobs for invoices, reminders, suspension, termination and queue retries.
7. Add role-based permission enforcement for Admin, Staff and Client.
8. Deploy frontend to `console.octalve.cloud` and backend API to the chosen server/API domain.
