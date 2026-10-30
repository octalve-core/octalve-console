# Octalve Cloud — Console & Django API

Octalve Cloud's **commercial management system**. This repository contains the Next.js customer/Staff/Admin Console and its Django REST API. The independent public website and technical hosting panel have their own repositories:

- Public storefront: [octalve-core/octalve-cloud](https://github.com/octalve-core/octalve-cloud) — `https://cloud.octalve.com`
- Console + Django API: **this repository** — `https://console.cloud.octalve.com`, `https://api.cloud.octalve.com`
- OPanel technical hosting management: [octalve-core/octalve-opanel](https://github.com/octalve-core/octalve-opanel)
- Octalve Invoice: visual reference only, **not** the commercial ledger or login authority.

## Start here: current implementation and remaining work

**[Full end-to-end audit, real Production evidence and prioritized gap register](docs/OCTALVE_CLOUD_FULL_SYSTEM_AUDIT_2026-10-30.md)**

**[Documentation index and historical source decisions](docs/README.md)**

The detailed audit distinguishes *source and CI implemented*, *live verified*, *external service gated* and *not yet operational*. **Do not use older dated batch reports as live deployment or database migration instructions.**

## Current verified release baseline — 30 October 2026

- Console frontend and Django API are deployed on Vercel Production at Git SHA `d7825d7e58ffb36b7105c1ef32e9faa408d2b044` (at audit time).
- Neon Production has **59 applied migrations / 111 tables**, including Batch 2 Settings 0002–0005; do not rerun historical migration commands.
- Frontend route source inventory: **135 Next.js pages** (85 Admin, 33 Client, 10 Staff, 7 public/auth). **810 authenticated responsive-browser observations are still required**, and no full signed matrix is claimed.
- Django includes accounts, RBAC, catalogue/published offers, orders, billing/invoice template, hosted checkout/payment proof gates, wallet ledger, provider security drafts, provisioning, domains, support, knowledge base, notifications/outbox, Settings, reports, audit, rewards and OPanel bridge.
- Important **commercial release hold:** Production currently has **zero approved published offers, zero public active product/plans and zero supplier records**. Payment settlement, supplier provisioning, domain registrar writes and OPanel external hosting remain separately gated.
- Settings support owner-saved policy, invoice numbering/template snapshots, tax preferences (not checkout-active), theme, email template editor and outbox. Initial email templates are inactive and **Brevo/Resend are not certified live senders**.
- Public Terms and Privacy routes returned 404 during audit; do not present signup legal acceptance as fully qualified.

## Local development (never point tests at Production)

Frontend: Node 20+, pinned pnpm 9.15.9, Next.js + TypeScript + Tailwind.

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
pnpm typecheck:frontend
pnpm build:frontend
```

Django: Python 3.12 and the **pinned** `backend/requirements.txt`. Use an isolated local/disposable database and reviewed environment config.

```bash
python -m venv .venv
# Activate .venv for your platform, then:
python -m pip install -r backend/requirements.txt
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
# Tests only against a disposable test database, NEVER Production.
```

GitHub Actions contains source, security, Django, frontend build and disposable PostgreSQL checks. **A green run is not real supplier connectivity, financial authorization, 810-case browser acceptance or a release signoff.**

## Non-negotiable authority boundaries

- Console owns retail catalogue, customer identity, orders, invoices, gateway settlement and hosting provisioning entitlement.
- OPanel owns technical hosting operations after exact verified Console authorization and a server-redeemed short-lived SSO grant.
- Published plans require verified inventory, documented supplier costs and versioned offers. No static client prices or fake availability.
- Never let customer profile forms edit money or award Staff/Admin permissions. Wallet money moves only through verified, idempotent ledger settlement.
- Provider secrets are never plain Console settings; protect connection-vault credentials, MFA step-up, audit and network egress before activation.
- Keep Preview deployments disabled. Use explicit, reviewed same-SHA Vercel Production deploy only after source, actual database migration, security and rollback gates.

See the [audit's prioritized acceptance batches](docs/OCTALVE_CLOUD_FULL_SYSTEM_AUDIT_2026-10-30.md#7-prioritized-delivery-batches-and-acceptance-gates) for the next execution work.
