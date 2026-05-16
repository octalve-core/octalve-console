# Octalve Console — Frontend/Backend Handoff

## Purpose

This document explains what the backend developer requested, what has already been implemented on the frontend, what still needs to be connected, and the expected continuation path.

The goal is to keep Octalve Console aligned as a hosting/business operating system for Octalve Cloud: client ordering, billing, domains, services, wallet, tickets, knowledge base, gateways, provider adapters, provisioning queue, admin controls, staff operations, and audit logs.

---

## Current project structure

The repository is a monorepo-style workspace:

```txt
octalve-console/
  package.json
  pnpm-workspace.yaml
  frontend/
    package.json
    src/
      app/
      components/
      context/
      lib/
  backend/
    apps/
    config/
    requirements.txt
  docs/
```

Frontend stack:

```txt
Next.js 14
React 18
TypeScript
pnpm workspace
Global CSS design system
lucide-react icons
```

Backend skeleton:

```txt
Django / Django REST Framework direction
Provider adapter skeleton already started
Provider contracts already exist
Future queue-first provisioning expected
```

---

## What the backend developer requested

The backend developer requested the following:

1. Frontend should not depend only on static data.
2. Admin, billing, domains, products, plans, orders, services, wallet, tickets and settings data should be fetched through API.
3. AuthContext should be fixed.
4. Backend architecture and database tables should be prepared.
5. Roles should be added because roles were not previously handled in the backend.
6. Frontend should be ready to connect to backend endpoints without breaking the current UI.

---

## What has already been implemented on the frontend

### 1. Typed API client

Files created:

```txt
frontend/src/lib/api/client.ts
frontend/src/lib/api/endpoints.ts
frontend/src/lib/api/types.ts
```

The API client supports:

```txt
GET
POST
PUT
PATCH
DELETE
Bearer token attachment
JSON request/response handling
FormData support
Query params
Timeout handling
API error class
Token storage
```

The current frontend API base URL is controlled by:

```txt
NEXT_PUBLIC_API_BASE_URL
```

Fallback default:

```txt
http://127.0.0.1:8001/api/v1
```

### 2. AuthContext

AuthContext was introduced/fixed so the frontend can manage:

```txt
current user
login
signup
logout
role dashboard routing
token storage
auth state loading
```

Expected auth response shape:

```json
{
  "access": "ACCESS_TOKEN_HERE",
  "refresh": "REFRESH_TOKEN_HERE",
  "user": {
    "id": "1",
    "name": "Octalve Admin",
    "email": "admin@octalve.cloud",
    "role": "admin"
  }
}
```

Accepted roles:

```txt
admin
staff
client
```

Role dashboards:

```txt
admin  -> /admin
staff  -> /staff
client -> /client
```

### 3. Role-based access direction

A staff login was able to manually type admin URLs and access admin pages. This is not correct for production.

Expected backend/frontend rule:

```txt
admin users can access /admin.
staff users should not access /admin unless explicitly permitted.
client users should not access /admin or /staff.
unauthenticated users should be redirected to /login.
```

Frontend protection is useful for UX, but backend enforcement is compulsory.

### 4. Premium UI uplift started

The UI has been upgraded in phases:

```txt
Phase 1: Global shell/navigation/topbar uplift
Phase 2: Client portal experience uplift
Phase 3: Client services, wallet, domain, ticket and checkout improvements
Phase 4: Admin premium table uplift
```

Already improved areas include:

```txt
Client dashboard direction
Client services listing
Client checkout
Client wallet
Client domains
Client domain management
Client knowledge base direction
Admin products
Admin orders
Admin customers
Admin invoices
Admin provisioning queue
Admin domains
Admin transactions
Admin gateways
Admin staff
Admin support tickets
Admin plans
Admin servers/adapters
```

Some inner detail pages still need premium layout uplift.

---

## API endpoint map currently expected by the frontend

### Auth

```txt
POST /api/v1/auth/login/
POST /api/v1/auth/signup/
POST /api/v1/auth/logout/
GET  /api/v1/auth/me/
```

### Public catalog

```txt
GET /api/v1/catalog/products/
GET /api/v1/catalog/plans/
GET /api/v1/knowledge-base/
```

### Client

```txt
GET  /api/v1/client/dashboard/
GET  /api/v1/client/services/
GET  /api/v1/client/services/{id}/
POST /api/v1/client/services/{id}/reboot/
POST /api/v1/client/services/{id}/start/
POST /api/v1/client/services/{id}/stop/
POST /api/v1/client/services/{id}/request_migration/
POST /api/v1/client/services/{id}/change_password/

GET  /api/v1/client/domains/
GET  /api/v1/client/domains/{id}/
POST /api/v1/client/domains/{id}/nameservers/
POST /api/v1/client/domains/{id}/dns-records/
POST /api/v1/client/domains/{id}/renew/

GET  /api/v1/client/invoices/
GET  /api/v1/client/invoices/{id}/

GET  /api/v1/client/orders/
POST /api/v1/client/orders/

GET  /api/v1/client/wallet/
POST /api/v1/client/wallet/fund/
GET  /api/v1/client/wallet/ledger/
POST /api/v1/client/wallet/apply-to-invoice/

GET  /api/v1/client/support/tickets/
POST /api/v1/client/support/tickets/
POST /api/v1/client/support/tickets/{id}/reply/

GET  /api/v1/client/knowledge-base/
GET  /api/v1/client/knowledge-base/{id}/
```

### Admin

```txt
GET  /api/v1/admin/customers/
POST /api/v1/admin/customers/
PATCH /api/v1/admin/customers/{id}/

GET  /api/v1/admin/products/
POST /api/v1/admin/products/
PATCH /api/v1/admin/products/{id}/

GET  /api/v1/admin/plans/
POST /api/v1/admin/plans/
PATCH /api/v1/admin/plans/{id}/

GET  /api/v1/admin/orders/
PATCH /api/v1/admin/orders/{id}/

GET  /api/v1/admin/services/
POST /api/v1/admin/services/{id}/provision/
POST /api/v1/admin/services/{id}/suspend/
POST /api/v1/admin/services/{id}/unsuspend/
POST /api/v1/admin/services/{id}/terminate/
POST /api/v1/admin/services/{id}/renew/

GET  /api/v1/admin/invoices/
GET  /api/v1/admin/transactions/
GET  /api/v1/admin/domains/
GET  /api/v1/admin/gateways/
PATCH /api/v1/admin/gateways/{id}/

GET  /api/v1/admin/providers/
POST /api/v1/admin/providers/
PATCH /api/v1/admin/providers/{id}/
POST /api/v1/admin/providers/{id}/test-connection/

GET  /api/v1/admin/settings/
PATCH /api/v1/admin/settings/

GET  /api/v1/admin/api-keys/
POST /api/v1/admin/api-keys/

GET  /api/v1/admin/notification-templates/
GET  /api/v1/admin/support/tickets/
GET  /api/v1/admin/knowledge-base/
GET  /api/v1/admin/audit-logs/
GET  /api/v1/admin/reports/
GET  /api/v1/admin/provisioning/queue/
POST /api/v1/admin/provisioning/queue/{id}/run/
```

---

## Product, plan and checkout sync expectation

The frontend now expects pricing to be centralized so there is no mismatch between:

```txt
main website pricing
client order page
checkout page
admin product/plan tables
backend product/plan records
invoice amount
payment amount
provisioned package
welcome email
renewal amount
```

Important rule:

```txt
The backend should be the source of truth for products, plans, billing cycles, discounts, tax, coupons and provider mapping.
```

The frontend can still keep temporary data for development, but production data should come from API.

### Product flow

Expected product lifecycle:

```txt
Admin creates/updates product
Admin creates/updates plan
Plan is mapped to a provider adapter
Plan is mapped to provider package name / package ID
Client selects plan
Checkout creates order and invoice
Client pays invoice
Payment is verified by webhook
Provisioning task is queued
Provider adapter creates service
Welcome email is sent
Service appears in client portal
Audit log is written
```

---

## Checkout expectations

Checkout should support:

```txt
Product category selection
Plan selection
Billing cycle selection
Domain option
Coupon code
Add-ons / upsells
Payment method
Wallet balance
Tax
Discount
Total due today
Renewal amount
Secure payment initialization
```

Domain options:

```txt
Use existing domain
Register new domain
Transfer domain
```

Add-ons / upsells:

```txt
SSL certificate
Business email
Backup
Migration support
Security add-on
```

Client should not see technical adapter names such as DirectAdminAdapter or DomainRegistrarAdapter. The backend should store that mapping internally.

---

## Provider adapter direction

Existing backend provider skeleton includes:

```txt
backend/apps/providers/contracts.py
backend/apps/providers/registry.py
backend/apps/providers/adapters/
```

Adapters already planned:

```txt
DirectAdminAdapter
CpanelAdapter
PleskAdapter
VirtualizorAdapter
ProxmoxAdapter
CustomProviderAdapter
EnhanceAdapter
PterodactylAdapter
VirtFusionAdapter
CloudflareAdapter
DomainRegistrarAdapter
SslProviderAdapter
EmailProviderAdapter
BackupProviderAdapter
```

The first real adapter should be DirectAdmin.

Minimum DirectAdmin milestone:

```txt
test connection
create hosting account
suspend account
unsuspend account
terminate account
change package
change password
fetch usage
return control panel login URL if supported
```

---

## Settings pages expected

Admin settings pages expected from Paymenter-like structure:

```txt
/admin/settings/general
/admin/settings/security
/admin/settings/social-login
/admin/settings/tax
/admin/settings/mail
/admin/settings/tickets
/admin/settings/cron-jobs
/admin/settings/credits
/admin/settings/theme
/admin/settings/invoices
/admin/settings/other
/admin/settings/providers
/admin/settings/api-keys
/admin/settings/notifications
```

Backend should expose settings registry endpoints for these groups.

Expected backend setting API:

```txt
GET /api/v1/admin/settings/
GET /api/v1/admin/settings/{group}/
PATCH /api/v1/admin/settings/{group}/
```

---

## Notification and email templates

The frontend has a notification template page direction.

Backend should support email/system notification templates similar to WHMCS/Blesta.

Template examples:

```txt
New login detected
New invoice created
New order created
Service activated
Service suspended
Service terminated
New ticket reply
Email verification
Password reset
Payment received
Invoice overdue
Domain renewal reminder
Hosting welcome email
VPS welcome email
Business email welcome email
SSL issued
Migration request received
```

Expected fields:

```txt
id
key
name
subject
body_html
body_text
enabled
channel
event_type
variables_schema
created_at
updated_at
```

---

## Knowledge base expectations

Knowledge base should support:

```txt
List articles
Read full article
Create article
Edit article
Preview article
Publish/unpublish article
Delete/archive article
Category
Visibility: public/client/staff/internal
Rich text content
SEO fields
Views
Likes
Attachments later
Audit logs
```

Frontend routes:

```txt
/admin/knowledge-base
/admin/knowledge-base/new
/admin/knowledge-base/{id}

/client/knowledge-base
/client/knowledge-base/{id}

/staff/knowledge-base
/staff/knowledge-base/{id}
```

---

## Wallet expectations

Client wallet should support:

```txt
Available balance
Deposit funds
Gateway selection
Ledger/history
Export ledger
Auto-pay invoice setting
Apply wallet to invoice
Manual admin credit
Debit records
Audit logs
```

Backend endpoints expected:

```txt
GET  /api/v1/client/wallet/
POST /api/v1/client/wallet/fund/
GET  /api/v1/client/wallet/ledger/
POST /api/v1/client/wallet/apply-to-invoice/
```

Admin should have:

```txt
GET  /api/v1/admin/wallet/ledger/
POST /api/v1/admin/customers/{id}/wallet/credit/
POST /api/v1/admin/customers/{id}/wallet/debit/
```

---

## Domain/DNS expectations

Client should see:

```txt
Domain name
Status
Expiry
Auto-renew status
Renew now action
Manage DNS
Nameserver update
DNS records
EPP code request
Transfer status
Add hosting/email/SSL upsell
```

Client should not see raw provider adapter names.

Backend should decide whether DNS is handled by:

```txt
Cloudflare
Registrar DNS
DirectAdmin DNS
Other provider
```

Expected records:

```txt
A
AAAA
CNAME
MX
TXT
SRV
CAA
NS
```

---

## Support ticket expectations

Ticket UI should support:

```txt
ticket list
ticket detail conversation
reply
attachments later
department
priority
status
assigned staff
internal notes for staff/admin
predefined responses
ticket audit history
```

Client only sees customer-facing conversation.
Staff/admin can see internal notes and assignment tools.

---

## Cleanup before pushing to GitHub

Before pushing, remove backup and generated temporary files that should not be committed:

```txt
*.bak
*.phase1.bak.tsx
final-polish-typecheck.txt
typecheck-errors*.txt
project-structure.txt
node_modules/
.next/
.env
.env.local
```

Recommended `.gitignore` should include:

```txt
node_modules/
.next/
out/
dist/
.env
.env.*
!.env.example
*.log
*.bak
*.tmp
*.swp
typecheck-errors*.txt
final-polish-typecheck.txt
project-structure.txt
```

---

## Recommended Git commands

From project root:

```powershell
cd "C:\Users\Bi Creativity\octalve-console"

git status
git add .
git status
git commit -m "Prepare frontend API handoff and premium console UI updates"
git push origin main
```

If backup files were accidentally staged:

```powershell
git restore --staged .
```

Then clean/remove ignored junk and stage again.

---

## Next frontend work

Next UI phase:

```txt
Admin inner detail pages uplift
Admin product detail
Admin plan detail
Admin customer detail
Admin order detail
Admin invoice detail
Admin domain detail
Admin transaction detail
Admin gateway configuration
Admin provider/server detail
Admin support ticket detail
Admin staff detail
Admin settings group pages
```

Backend should continue in parallel with:

```txt
Auth + RBAC
Products/plans
Orders/invoices/payments
Paystack test integration
DirectAdmin test adapter
Provisioning queue
Services
Domains/DNS
Wallet
Support tickets
Knowledge base
Settings registry
Audit logs
```
