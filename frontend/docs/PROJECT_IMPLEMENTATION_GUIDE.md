# Octalve Console — Full MVP Implementation Guide

## Product direction

Octalve Console is not just a billing panel. It should become the business operating system for Octalve Cloud: customers order products, pay invoices, manage services, open tickets, use wallet credits and receive automated provisioning through adapters.

The target benchmark is:

- WHMCS/Blesta depth for hosting billing, invoices, domains, services and support.
- Paymenter-style clean integration settings and provider configuration.
- Hostinger/Namecheap/GoDaddy-style client experience for ordering, managing DNS, service usage, hosting files, VPS, SSL, migration and renewals.

## MVP modules included in this package

### Admin

- Overview dashboard
- Customers
- Orders
- Products
- Plans and pricing
- Servers and adapters
- Provisioning queue
- Billing
  - invoices
  - transactions
  - services
  - domains
  - quotes
  - print queue
  - batch processing
- Gateways
- Affiliates
- Tools
  - service queue
  - currency converter
  - mass mailer
  - blacklist
  - download manager
  - CMS pages
  - utilities
- Support
  - tickets
  - departments
  - predefined responses
  - staff
- Knowledge base
- Invoice designer
- Reports
- Audit logs
- Settings
  - general
  - security
  - social login
  - tax
  - mail
  - tickets
  - cron jobs
  - credits
  - theme
  - invoices
  - API keys
  - notifications
  - providers

### Client

- Dashboard
- Direct order page
- Checkout page
- My services
- Service management page
  - overview
  - DNS
  - files
  - usage
  - backups
  - email accounts
  - VPS panel
  - migration request
- Domains
- Invoices
- Wallet
- Orders
- Support tickets
- Knowledge base
- Profile

### Staff

- Staff dashboard
- Tickets
- Orders
- Customers
- Provisioning
- Knowledge base
- Security queue

## What is mock now

The current frontend is an MVP interface. It uses shared demo data from:

```txt
frontend/src/lib/platform-data.ts
```

This file intentionally centralizes mock products, plans, orders, invoices, gateways, adapters and settings so the UI can work before the Django API is connected.

## How to replace mock data with backend API

The next phase should create a typed API client inside:

```txt
frontend/src/lib/api.ts
```

Recommended endpoint mapping:

```txt
GET    /api/products/
POST   /api/products/
GET    /api/plans/
POST   /api/plans/
GET    /api/orders/
POST   /api/orders/
GET    /api/services/
GET    /api/services/{id}/
POST   /api/services/{id}/action/
GET    /api/invoices/
POST   /api/invoices/{id}/pay/
POST   /api/payments/paystack/initialize/
POST   /api/webhooks/paystack/
POST   /api/webhooks/flutterwave/
GET    /api/domains/
POST   /api/domains/{id}/nameservers/
POST   /api/tickets/
POST   /api/tickets/{id}/reply/
GET    /api/settings/
PUT    /api/settings/{group}/
```

## Automatic billing flow

1. Client selects a plan on `/client/order`.
2. Checkout calculates first invoice using plan cycle, currency, tax, discounts and credits.
3. Order is created with status `PENDING_PAYMENT`.
4. Invoice is created with status `UNPAID`.
5. Client pays through Paystack, Flutterwave, crypto, bank transfer, wallet or manual payment.
6. Payment webhook verifies the transaction.
7. Invoice becomes `PAID`.
8. Order becomes `READY_FOR_PROVISIONING`.
9. Provisioning queue picks the order.
10. Adapter provisions hosting/domain/VPS/SSL/email/backup.
11. Service becomes `ACTIVE`.
12. Renewal cron generates the next invoice before due date.
13. If invoice remains unpaid after grace period, suspension queue runs.
14. If still unpaid after termination period, termination queue runs.

## Domain automation flow

1. Admin configures a `DomainRegistrarAdapter` provider.
2. Admin configures TLDs, pricing, nameservers and supported features.
3. Client orders domain registration/transfer.
4. Payment confirmed.
5. Registrar adapter registers/transfers domain.
6. Domain record stores provider ID, expiry date, EPP status and nameservers.
7. Client can update nameservers/DNS depending on provider support.
8. Cron checks renewal dates and creates invoice.

## Hosting automation flow

1. Admin creates server provider: DirectAdmin first.
2. Admin maps package to provider package name and server group.
3. Client orders hosting.
4. Payment confirmed.
5. Adapter creates account on DirectAdmin.
6. Service page exposes management shortcuts: DNS, file manager, usage, backups, email accounts, SSL and migration.
7. Suspension and unsuspension actions go through the same adapter contract.

## Wallet flow

1. Client deposits wallet credit through supported gateway.
2. Payment confirmed.
3. Wallet ledger records credit transaction.
4. Wallet can auto-pay recurring invoices when balance is enough.
5. Downgrades can optionally return prorated credit.
6. Every wallet movement must create an audit log.

## Support flow

1. Client creates ticket.
2. Department rules assign priority and staff group.
3. Staff replies from staff or admin console.
4. Status moves between awaiting staff, awaiting client, in progress, on hold, closed and trash.
5. Predefined responses and knowledge base should reduce repetitive support.

## Client management flow

Admin should be able to view a customer and see:

- profile
- contacts
- services
- domains
- invoices
- transactions
- tickets
- wallet balance
- audit history
- notes
- fraud/security flags

## Performance requirements

- Paginate all heavy tables.
- Server-render list pages where possible.
- Cache settings and public catalog data.
- Queue provider calls instead of blocking checkout.
- Retry failed provisioning tasks safely.
- Store every external provider request/response log with sensitive data redacted.

## Immediate backend priority

1. Authentication and RBAC.
2. Products, plans and order models.
3. Invoice/payment models.
4. Paystack test integration.
5. DirectAdmin test adapter.
6. Provisioning queue.
7. Service management endpoint.
8. Client support tickets.
9. Audit log.
10. Settings registry.
