> **Verified Production baseline (2026-10-24):** Cloud Console and Django API are READY at GitHub `main` commit `0c58053370fde84ed14717b0688d91bb53ba359e`. Client signup, login, logout and role routing passed initial user browser testing. Neon Production `main` holds 48 migrations and 91 tables. **SEC-01 PR #5 and PR #6 are Review-only and not released**; paid hosting, payment settlement and real provisioning are not accepted. The earlier MVP notes below are historical, not current-state guarantees. See `docs/CLOUD_SEC01_AUTH_ABUSE_QUALIFICATION_2026-10-24.md` and `docs/CLOUD_PRODUCTION_READINESS_GATE_2026-10-24.md`.

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
