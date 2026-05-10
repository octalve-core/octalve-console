// src/lib/api/schema-api.ts

import { auditApi } from "./modules/audit.api";
import { authApiV2 } from "./modules/auth.api";
import { billingApi } from "./modules/billing.api";
import { catalogApi } from "./modules/catalog.api";
import { domainsApi } from "./modules/domains.api";
import { ordersApi } from "./modules/orders.api";
import { paymentsApi } from "./modules/payments.api";
import { providersApi } from "./modules/providers.api";
import { provisioningApi } from "./modules/provisioning.api";
import { reportsApi } from "./modules/reports.api";
import { servicesApi } from "./modules/services.api";
import { settingsApi } from "./modules/settings.api";
import { supportApi } from "./modules/support.api";

/**
 * OpenAPI-aligned API surface.
 *
 * New frontend work should prefer importing from this file or the specific
 * module files in src/lib/api/modules.
 *
 * Existing pages can continue using endpoints.ts until they are migrated.
 */
export const schemaApi = {
  audit: auditApi,
  auth: authApiV2,
  billing: billingApi,
  catalog: catalogApi,
  domains: domainsApi,
  orders: ordersApi,
  payments: paymentsApi,
  providers: providersApi,
  provisioning: provisioningApi,
  reports: reportsApi,
  services: servicesApi,
  settings: settingsApi,
  support: supportApi,
};

export {
  auditApi,
  authApiV2,
  billingApi,
  catalogApi,
  domainsApi,
  ordersApi,
  paymentsApi,
  providersApi,
  provisioningApi,
  reportsApi,
  servicesApi,
  settingsApi,
  supportApi,
};
