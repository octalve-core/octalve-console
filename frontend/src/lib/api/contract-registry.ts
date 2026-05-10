import { apiPaths } from "@/lib/api/paths";

export type ApiContractEndpoint = {
  label: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  status: "Aligned" | "Needs backend confirmation" | "Fallback-ready";
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
      { label: "Login", method: "POST", path: apiPaths.auth.login, status: "Aligned" },
      { label: "Register", method: "POST", path: apiPaths.auth.register, status: "Aligned" },
      { label: "Current user", method: "GET", path: apiPaths.auth.me, status: "Aligned" },
      { label: "Password reset request", method: "POST", path: apiPaths.auth.resetPassword, status: "Aligned" },
      { label: "Password reset confirm", method: "POST", path: apiPaths.auth.resetPasswordConfirm, status: "Aligned" },
    ],
  },
  {
    area: "Catalog",
    module: "catalogApi",
    description: "Products, plans, categories, and provider mappings.",
    endpoints: [
      { label: "Products", method: "GET", path: apiPaths.catalog.products, status: "Aligned" },
      { label: "Plans", method: "GET", path: apiPaths.catalog.plans, status: "Aligned" },
      { label: "Categories", method: "GET", path: apiPaths.catalog.categories, status: "Fallback-ready" },
      { label: "Provider mappings", method: "GET", path: apiPaths.catalog.providerMappings, status: "Fallback-ready" },
    ],
  },
  {
    area: "Billing",
    module: "billingApi",
    description: "Invoices, quotes, taxes, PDF actions, and wallet invoice payment.",
    endpoints: [
      { label: "Invoices", method: "GET", path: apiPaths.billing.invoices, status: "Aligned" },
      { label: "Create invoice", method: "POST", path: apiPaths.billing.invoices, status: "Aligned" },
      { label: "Quotes", method: "GET", path: apiPaths.billing.quotes, status: "Fallback-ready" },
      { label: "Taxes", method: "GET", path: apiPaths.billing.taxes, status: "Fallback-ready" },
    ],
  },
  {
    area: "Orders",
    module: "ordersApi",
    description: "Cart, coupons, orders, cancellation, invoice linkage, and checkout flow.",
    endpoints: [
      { label: "Orders", method: "GET", path: apiPaths.orders.orders, status: "Aligned" },
      { label: "Create order", method: "POST", path: apiPaths.orders.orders, status: "Aligned" },
      { label: "Cart", method: "GET", path: apiPaths.orders.cart, status: "Fallback-ready" },
      { label: "Validate coupon", method: "POST", path: apiPaths.orders.couponValidate, status: "Fallback-ready" },
    ],
  },
  {
    area: "Payments",
    module: "paymentsApi",
    description: "Gateways, initialization, transactions, verification, and webhooks.",
    endpoints: [
      { label: "Gateways", method: "GET", path: apiPaths.payments.gateways, status: "Aligned" },
      { label: "Transactions", method: "GET", path: apiPaths.payments.transactions, status: "Aligned" },
      { label: "Initialize payment", method: "POST", path: apiPaths.payments.initialize, status: "Needs backend confirmation" },
      { label: "Verify payment", method: "GET", path: apiPaths.payments.verify, status: "Needs backend confirmation" },
    ],
  },
  {
    area: "Domains",
    module: "domainsApi",
    description: "Domains, DNS records, nameservers, SSL, TLD pricing, and search.",
    endpoints: [
      { label: "Domains", method: "GET", path: apiPaths.domains.domains, status: "Aligned" },
      { label: "Create domain", method: "POST", path: apiPaths.domains.domains, status: "Aligned" },
      { label: "DNS records", method: "GET", path: apiPaths.domains.dnsRecords, status: "Fallback-ready" },
      { label: "Domain search", method: "POST", path: apiPaths.domains.searchCheck, status: "Needs backend confirmation" },
    ],
  },
  {
    area: "Services",
    module: "servicesApi",
    description: "Hosting services, usage, credentials, actions, and change requests.",
    endpoints: [
      { label: "Services", method: "GET", path: apiPaths.services.services, status: "Aligned" },
      { label: "Create service", method: "POST", path: apiPaths.services.services, status: "Aligned" },
      { label: "Change requests", method: "GET", path: apiPaths.services.changeRequests, status: "Fallback-ready" },
    ],
  },
  {
    area: "Providers",
    module: "providersApi",
    description: "DirectAdmin, cPanel, VPS, registrar adapters, health, packages, and logs.",
    endpoints: [
      { label: "Providers", method: "GET", path: apiPaths.providers.providers, status: "Aligned" },
      { label: "Create provider", method: "POST", path: apiPaths.providers.providers, status: "Aligned" },
      { label: "Packages", method: "GET", path: apiPaths.providers.packages, status: "Fallback-ready" },
      { label: "Logs", method: "GET", path: apiPaths.providers.logs, status: "Fallback-ready" },
    ],
  },
  {
    area: "Provisioning",
    module: "provisioningApi",
    description: "Queues, tasks, retries, cancellations, manual review, and webhooks.",
    endpoints: [
      { label: "Tasks", method: "GET", path: apiPaths.provisioning.tasks, status: "Aligned" },
      { label: "Create task", method: "POST", path: apiPaths.provisioning.tasks, status: "Aligned" },
      { label: "Queues", method: "GET", path: apiPaths.provisioning.queues, status: "Fallback-ready" },
      { label: "Webhooks", method: "GET", path: apiPaths.provisioning.webhooks, status: "Fallback-ready" },
    ],
  },
  {
    area: "Support",
    module: "supportApi",
    description: "Tickets, replies, departments, predefined responses, and escalation rules.",
    endpoints: [
      { label: "Tickets", method: "GET", path: apiPaths.support.tickets, status: "Aligned" },
      { label: "Create ticket", method: "POST", path: apiPaths.support.tickets, status: "Aligned" },
      { label: "Departments", method: "GET", path: apiPaths.support.departments, status: "Fallback-ready" },
      { label: "Predefined responses", method: "GET", path: apiPaths.support.predefinedResponses, status: "Fallback-ready" },
    ],
  },
  {
    area: "Settings, Reports, Audit",
    module: "settingsApi / reportsApi / auditApi",
    description: "System configuration, metrics, widgets, audit logs, security events, and exports.",
    endpoints: [
      { label: "Settings", method: "GET", path: apiPaths.settings.settings, status: "Fallback-ready" },
      { label: "Reports", method: "GET", path: apiPaths.reports.definitions, status: "Fallback-ready" },
      { label: "Audit logs", method: "GET", path: apiPaths.audit.logs, status: "Fallback-ready" },
      { label: "Security events", method: "GET", path: apiPaths.audit.securityEvents, status: "Fallback-ready" },
    ],
  },
];

export function getApiContractSummary() {
  const endpoints = apiContractSections.flatMap((section) => section.endpoints);

  return {
    sections: apiContractSections.length,
    endpoints: endpoints.length,
    aligned: endpoints.filter((endpoint) => endpoint.status === "Aligned").length,
    fallbackReady: endpoints.filter((endpoint) => endpoint.status === "Fallback-ready").length,
    needsConfirmation: endpoints.filter((endpoint) => endpoint.status === "Needs backend confirmation").length,
  };
}