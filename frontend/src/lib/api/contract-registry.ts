import { apiPaths } from "@/lib/api/paths";

export type ApiContractEndpoint = {
  label: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  status: "Source mapped" | "Requires qualification" | "Policy blocked";
  expectedOutcome: string;
  observedOutcome: string;
  evidence: "source inspection only";
};

export type ApiContractSection = {
  area: string;
  module: string;
  description: string;
  endpoints: ApiContractEndpoint[];
};

export const apiContractSections: ApiContractSection[] = [
  {
    area: "Authentication",
    module: "authApiV2",
    description: "Django JWT authentication, registration, profile, and password reset.",
    endpoints: [
      { label: "Login", method: "POST", path: apiPaths.auth.login, status: "Source mapped", expectedOutcome: "Password login must issue a scoped, server-verified session or deny without revealing account existence", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Register", method: "POST", path: apiPaths.auth.register, status: "Requires qualification", expectedOutcome: "Only allowed role and validated serializer fields; unauthorized or disabled writes must fail closed", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Current user", method: "GET", path: apiPaths.auth.me, status: "Source mapped", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Password reset request", method: "POST", path: apiPaths.auth.resetPassword, status: "Source mapped", expectedOutcome: "Only allowed role and validated serializer fields; unauthorized or disabled writes must fail closed", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Password reset confirm", method: "POST", path: apiPaths.auth.resetPasswordConfirm, status: "Requires qualification", expectedOutcome: "Only allowed role and validated serializer fields; unauthorized or disabled writes must fail closed", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
    ],
  },
  {
    area: "Catalog",
    module: "catalogApi",
    description: "Products, plans, categories, and provider mappings.",
    endpoints: [
      { label: "Products", method: "GET", path: apiPaths.catalog.products, status: "Source mapped", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Plans", method: "GET", path: apiPaths.catalog.plans, status: "Source mapped", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Categories", method: "GET", path: apiPaths.catalog.categories, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Provider mappings", method: "GET", path: apiPaths.catalog.providerMappings, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
    ],
  },
  {
    area: "Billing",
    module: "billingApi",
    description: "Invoices, quotes, taxes, PDF actions, and wallet invoice payment.",
    endpoints: [
      { label: "Invoices", method: "GET", path: apiPaths.billing.invoices, status: "Source mapped", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Create invoice", method: "POST", path: apiPaths.billing.invoices, status: "Policy blocked", expectedOutcome: "Django must refuse the unsafe direct mutation with no customer/provider side effects", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Quotes", method: "GET", path: apiPaths.billing.quotes, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Taxes", method: "GET", path: apiPaths.billing.taxes, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
    ],
  },
  {
    area: "Orders",
    module: "ordersApi",
    description: "Cart, coupons, orders, cancellation, invoice linkage, and checkout flow.",
    endpoints: [
      { label: "Orders", method: "GET", path: apiPaths.orders.orders, status: "Source mapped", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Create order", method: "POST", path: apiPaths.orders.orders, status: "Requires qualification", expectedOutcome: "Authenticated client-only checkout, versioned offer, server-calculated price and idempotent order/invoice", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Cart", method: "GET", path: apiPaths.orders.cart, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Validate coupon", method: "POST", path: apiPaths.orders.couponValidate, status: "Requires qualification", expectedOutcome: "Only allowed role and validated serializer fields; unauthorized or disabled writes must fail closed", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
    ],
  },
  {
    area: "Payments",
    module: "paymentsApi",
    description: "Gateways, initialization, transactions, verification, and webhooks.",
    endpoints: [
      { label: "Gateways", method: "GET", path: apiPaths.payments.gateways, status: "Source mapped", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Transactions", method: "GET", path: apiPaths.payments.transactions, status: "Source mapped", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Initialize payment", method: "POST", path: apiPaths.payments.initialize, status: "Requires qualification", expectedOutcome: "Verified invoice-only hosted checkout must remain disabled until financial release", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Verify payment", method: "GET", path: apiPaths.payments.verify, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
    ],
  },
  {
    area: "Domains",
    module: "domainsApi",
    description: "Domains, DNS records, nameservers, SSL, TLD pricing, and search.",
    endpoints: [
      { label: "Domains", method: "GET", path: apiPaths.domains.domains, status: "Source mapped", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Create domain", method: "POST", path: apiPaths.domains.domains, status: "Policy blocked", expectedOutcome: "Django must refuse the unsafe direct mutation with no customer/provider side effects", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "DNS records", method: "GET", path: apiPaths.domains.dnsRecords, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Domain search", method: "POST", path: apiPaths.domains.searchCheck, status: "Requires qualification", expectedOutcome: "No registrar availability claim or purchase while supplier adapter is unqualified", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
    ],
  },
  {
    area: "Services",
    module: "servicesApi",
    description: "Hosting services, usage, credentials, actions, and change requests.",
    endpoints: [
      { label: "Services", method: "GET", path: apiPaths.services.services, status: "Source mapped", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Create service", method: "POST", path: apiPaths.services.services, status: "Policy blocked", expectedOutcome: "Django must refuse the unsafe direct mutation with no customer/provider side effects", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Change requests", method: "GET", path: apiPaths.services.changeRequests, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
    ],
  },
  {
    area: "Providers",
    module: "providersApi",
    description: "DirectAdmin, cPanel, VPS, registrar adapters, health, packages, and logs.",
    endpoints: [
      { label: "Providers", method: "GET", path: apiPaths.providers.providers, status: "Source mapped", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Create provider", method: "POST", path: apiPaths.providers.providers, status: "Policy blocked", expectedOutcome: "Django must refuse the unsafe direct mutation with no customer/provider side effects", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Packages", method: "GET", path: apiPaths.providers.packages, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Logs", method: "GET", path: apiPaths.providers.logs, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
    ],
  },
  {
    area: "Provisioning",
    module: "provisioningApi",
    description: "Queues, tasks, retries, cancellations, manual review, and webhooks.",
    endpoints: [
      { label: "Tasks", method: "GET", path: apiPaths.provisioning.tasks, status: "Source mapped", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Create task", method: "POST", path: apiPaths.provisioning.tasks, status: "Policy blocked", expectedOutcome: "Django must refuse the unsafe direct mutation with no customer/provider side effects", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Queues", method: "GET", path: apiPaths.provisioning.queues, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Webhooks", method: "GET", path: apiPaths.provisioning.webhooks, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
    ],
  },
  {
    area: "Support",
    module: "supportApi",
    description: "Tickets, replies, departments, predefined responses, and escalation rules.",
    endpoints: [
      { label: "Tickets", method: "GET", path: apiPaths.support.tickets, status: "Source mapped", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Create ticket", method: "POST", path: apiPaths.support.tickets, status: "Source mapped", expectedOutcome: "Only allowed role and validated serializer fields; unauthorized or disabled writes must fail closed", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Departments", method: "GET", path: apiPaths.support.departments, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Predefined responses", method: "GET", path: apiPaths.support.predefinedResponses, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
    ],
  },
  {
    area: "Settings, Reports, Audit",
    module: "settingsApi / reportsApi / auditApi",
    description: "System configuration, metrics, widgets, audit logs, security events, and exports.",
    endpoints: [
      { label: "Settings", method: "GET", path: apiPaths.settings.settings, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Reports", method: "GET", path: apiPaths.reports.definitions, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Audit logs", method: "GET", path: apiPaths.audit.logs, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
      { label: "Security events", method: "GET", path: apiPaths.audit.securityEvents, status: "Requires qualification", expectedOutcome: "Role- or owner-scoped read; explicit 401/403/404, valid list envelope and no secret disclosure", observedOutcome: "Not exercised in an authenticated Production test", evidence: "source inspection only" },
    ],
  },
];

export function getApiContractSummary() {
  const endpoints = apiContractSections.flatMap((section) => section.endpoints);

  return {
    sections: apiContractSections.length,
    endpoints: endpoints.length,
    aligned: endpoints.filter((endpoint) => endpoint.status === "Source mapped").length,
    fallbackReady: endpoints.filter((endpoint) => endpoint.status === "Requires qualification").length,
    needsConfirmation: endpoints.filter((endpoint) => endpoint.status === "Policy blocked").length,
  };
}