# Octalve Cloud Batch B: Admin and Staff browser route inventory
Generated from exact baseline Git tree `3d763bb8eb6241298203d9388230bba23c1412e6`.

**Scope:** 85 Admin routes + 10 Staff routes = 95. Each must be authenticated and checked at 320/360/390/768/1024/1440px (**570 cases**), including role denial, phone and desktop focus, data/empty/error states, actions and CSS computed layout. No browser screenshot evidence has been supplied by CI: **PENDING**.

**Source-level ownership migration included:** AdminOverviewMetrics, StaffOverviewMetrics, AdminGenericDirectory, AdminResourceDirectory, StaffOperationalDirectory and shared WorkspaceGrid/ConsoleIconTile. Routes importing those components benefit from reusable layout fixes, but the rest of their DOM remains subject to review. This matrix does not claim 95 migrated routes.

| Role | Route | Workstream | Authenticated six-width evidence |
| --- | --- | --- | --- |
| Admin | `/admin/affiliates/[id]` | Other / workbench | Pending |
| Admin | `/admin/affiliates/new` | Other / workbench | Pending |
| Admin | `/admin/affiliates` | Other / workbench | Pending |
| Admin | `/admin/audit-logs` | Other / workbench | Pending |
| Admin | `/admin/billing/batch` | Billing / orders | Pending |
| Admin | `/admin/billing/domains/[id]` | Billing / orders | Pending |
| Admin | `/admin/billing/domains/new` | Billing / orders | Pending |
| Admin | `/admin/billing/domains` | Billing / orders | Pending |
| Admin | `/admin/billing/invoices/[id]` | Billing / orders | Pending |
| Admin | `/admin/billing/invoices/new` | Billing / orders | Pending |
| Admin | `/admin/billing/invoices` | Billing / orders | Pending |
| Admin | `/admin/billing` | Billing / orders | Pending |
| Admin | `/admin/billing/print-queue` | Billing / orders | Pending |
| Admin | `/admin/billing/quotes/[id]` | Billing / orders | Pending |
| Admin | `/admin/billing/quotes/new` | Billing / orders | Pending |
| Admin | `/admin/billing/quotes` | Billing / orders | Pending |
| Admin | `/admin/billing/services/[id]` | Billing / orders | Pending |
| Admin | `/admin/billing/services/new` | Billing / orders | Pending |
| Admin | `/admin/billing/services` | Billing / orders | Pending |
| Admin | `/admin/billing/transactions/[id]` | Billing / orders | Pending |
| Admin | `/admin/billing/transactions/new` | Billing / orders | Pending |
| Admin | `/admin/billing/transactions` | Billing / orders | Pending |
| Admin | `/admin/catalog/workbench` | Catalogue | Pending |
| Admin | `/admin/customers/[id]` | Other / workbench | Pending |
| Admin | `/admin/customers/new` | Other / workbench | Pending |
| Admin | `/admin/customers` | Other / workbench | Pending |
| Admin | `/admin/gateways/[id]` | Other / workbench | Pending |
| Admin | `/admin/gateways/new` | Other / workbench | Pending |
| Admin | `/admin/gateways` | Other / workbench | Pending |
| Admin | `/admin/gateways/paystack` | Other / workbench | Pending |
| Admin | `/admin/integrations` | Services / integrations | Pending |
| Admin | `/admin/invoice-designer` | Other / workbench | Pending |
| Admin | `/admin/knowledge-base/[id]` | Support | Pending |
| Admin | `/admin/knowledge-base/new` | Support | Pending |
| Admin | `/admin/knowledge-base` | Support | Pending |
| Admin | `/admin/orders/[id]` | Billing / orders | Pending |
| Admin | `/admin/orders/new` | Billing / orders | Pending |
| Admin | `/admin/orders` | Billing / orders | Pending |
| Admin | `/admin` | Other / workbench | Pending |
| Admin | `/admin/plans/[id]` | Catalogue | Pending |
| Admin | `/admin/plans/new` | Catalogue | Pending |
| Admin | `/admin/plans` | Catalogue | Pending |
| Admin | `/admin/products/[id]` | Catalogue | Pending |
| Admin | `/admin/products/new` | Catalogue | Pending |
| Admin | `/admin/products` | Catalogue | Pending |
| Admin | `/admin/provisioning` | Services / integrations | Pending |
| Admin | `/admin/provisioning/run` | Services / integrations | Pending |
| Admin | `/admin/reports` | Reports | Pending |
| Admin | `/admin/rewards` | Other / workbench | Pending |
| Admin | `/admin/servers/[id]` | Services / integrations | Pending |
| Admin | `/admin/servers/new` | Services / integrations | Pending |
| Admin | `/admin/servers` | Services / integrations | Pending |
| Admin | `/admin/settings/api-keys` | Settings / security | Pending |
| Admin | `/admin/settings/credits` | Settings / security | Pending |
| Admin | `/admin/settings/cron-jobs` | Settings / security | Pending |
| Admin | `/admin/settings/general` | Settings / security | Pending |
| Admin | `/admin/settings/invoices` | Billing / orders | Pending |
| Admin | `/admin/settings/mail` | Settings / security | Pending |
| Admin | `/admin/settings/notifications/[id]` | Settings / security | Pending |
| Admin | `/admin/settings/notifications/new` | Settings / security | Pending |
| Admin | `/admin/settings/notifications` | Settings / security | Pending |
| Admin | `/admin/settings/other` | Settings / security | Pending |
| Admin | `/admin/settings` | Settings / security | Pending |
| Admin | `/admin/settings/providers` | Settings / security | Pending |
| Admin | `/admin/settings/security` | Settings / security | Pending |
| Admin | `/admin/settings/social-login` | Settings / security | Pending |
| Admin | `/admin/settings/tax` | Settings / security | Pending |
| Admin | `/admin/settings/theme` | Settings / security | Pending |
| Admin | `/admin/settings/tickets` | Support | Pending |
| Admin | `/admin/staff/[id]` | Other / workbench | Pending |
| Admin | `/admin/staff/new` | Other / workbench | Pending |
| Admin | `/admin/staff` | Other / workbench | Pending |
| Admin | `/admin/support/[id]` | Support | Pending |
| Admin | `/admin/support/departments` | Support | Pending |
| Admin | `/admin/support/new` | Support | Pending |
| Admin | `/admin/support` | Support | Pending |
| Admin | `/admin/support/responses` | Support | Pending |
| Admin | `/admin/support/staff` | Support | Pending |
| Admin | `/admin/tools/blacklist` | Other / workbench | Pending |
| Admin | `/admin/tools/cms` | Other / workbench | Pending |
| Admin | `/admin/tools/currency` | Other / workbench | Pending |
| Admin | `/admin/tools/download-manager` | Other / workbench | Pending |
| Admin | `/admin/tools/mass-mailer` | Other / workbench | Pending |
| Admin | `/admin/tools/service-queue` | Other / workbench | Pending |
| Admin | `/admin/tools/utilities` | Other / workbench | Pending |
| Staff | `/staff/customers` | Other / workbench | Pending |
| Staff | `/staff/knowledge-base/[id]` | Support | Pending |
| Staff | `/staff/knowledge-base/new` | Support | Pending |
| Staff | `/staff/knowledge-base` | Support | Pending |
| Staff | `/staff/orders` | Billing / orders | Pending |
| Staff | `/staff` | Other / workbench | Pending |
| Staff | `/staff/provisioning` | Services / integrations | Pending |
| Staff | `/staff/security` | Settings / security | Pending |
| Staff | `/staff/tickets/[id]` | Support | Pending |
| Staff | `/staff/tickets` | Support | Pending |
