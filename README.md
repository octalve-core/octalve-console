# Octalve Cloud — Current execution priority

> **P0 — HOST-FINAL, approved 28 November 2026.** The authoritative hosting task order and completion scope are in [Final two-batch execution authority](docs/hosting-final/README.md). Execute [HOST-FINAL-01](docs/hosting-final/BATCH-01-EXECUTION.md) first; HOST-FINAL-02 follows only after qualified merge and both production deployments. The approved work covers actual customer hosting mailboxes, authoritative DNS, subdomains, databases, files, secure access and usage, followed by payment, renewal, transactional delivery and service lifecycle. Existing vault, tenant, financial and protected release gates remain mandatory. The latest audited baseline is `942bfaf3`; consult current main and live deployment evidence for current status. Draft PR #180 is reserved for Batch 2. No real provider is yet accepted. See [branch retirement evidence](docs/hosting-final/branch-cleanup-2026-11-28.json).

Production endpoints: [Console](https://console.cloud.octalve.com) · [API](https://api.cloud.octalve.com). See the [protected release runbook](docs/CLOUD_PRODUCTION_RELEASE_RUNBOOK_2026-10-26.md) and [acceptance matrix](docs/CLOUD_MASTER_ACCEPTANCE_MATRIX_2026-10-26.md) for continuing safeguards.

---

## Historical MVP material (not a current deployment or authentication guide)

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
