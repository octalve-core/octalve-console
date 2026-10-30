// src/lib/api/paths.ts

/**
 * OpenAPI-aligned API paths for Octalve Console.
 *
 * IMPORTANT:
 * These paths intentionally do not include the "/api" prefix.
 * The frontend API client base URL should already point to the backend API root.
 *
 * Example:
 * NEXT_PUBLIC_API_BASE_URL=https://backend-domain.com/api
 */

export const apiPaths = {
  auth: {
    login: "/auth/jwt/create/",
    refresh: "/auth/jwt/refresh/",
    verify: "/auth/jwt/verify/",
    logout: "/auth/logout/",
    register: "/auth/register/",
    usernameAvailability: "/auth/username-availability/",
    me: "/auth/users/me/",
    extendedMe: "/auth/me/",
    users: "/auth/users/",
    activation: "/auth/users/activation/",
    resendActivation: "/auth/users/resend_activation/",
    resetPassword: "/auth/users/reset_password/",
    resetPasswordConfirm: "/auth/users/reset_password_confirm/",
    setPassword: "/auth/users/set_password/",
    resetEmail: "/auth/users/reset_email/",
    resetEmailConfirm: "/auth/users/reset_email_confirm/",
    setEmail: "/auth/users/set_email/",
  },

  audit: {
    apiLogs: "/audit/api-logs/",
    loginAttempts: "/audit/login-attempts/",
    logs: "/audit/logs/",
    securityEvents: "/audit/security-events/",
    dataExports: "/audit/data-exports/",
  },

  billing: {
    invoices: "/billing/invoices/",
    quotes: "/billing/quotes/",
    taxes: "/billing/taxes/",
  },

  catalog: {
    categories: "/catalog/categories/",
    products: "/catalog/products/",
    plans: "/catalog/plans/",
    providerMappings: "/catalog/provider-mappings/",
  },

  domains: {
    domains: "/domains/domains/",
    dnsRecords: "/domains/dns-records/",
    sslCertificates: "/domains/ssl-certificates/",
    tldPricing: "/domains/tld-pricing/",
    searchCheck: "/domains/search/check/",
    searchRegister: "/domains/search/register/",
    searchSuggestions: "/domains/search/suggestions/",
    searchTransfer: "/domains/search/transfer/",
  },

  orders: {
    cart: "/orders/cart/get_cart/",
    cartAddItem: "/orders/cart/add_item/",
    cartRemoveItem: "/orders/cart/remove_item/",
    cartUpdateQuantity: "/orders/cart/update_quantity/",
    cartApplyCoupon: "/orders/cart/apply_coupon/",
    cartClear: "/orders/cart/clear/",
    coupons: "/orders/coupons/",
    couponValidate: "/orders/coupons/validate/",
    orders: "/orders/orders/",
  },

  payments: {
    gateways: "/payments/gateways/",
    initialize: "/payments/initialize/",
    transactions: "/payments/transactions/",
    verify: "/payments/verify/",
    webhook: "/payments/webhook/",
  },

  providers: {
    providers: "/providers/providers/",
    packages: "/providers/packages/",
    logs: "/providers/logs/",
  },

  provisioning: {
    queues: "/provisioning/queues/",
    tasks: "/provisioning/tasks/",
    webhooks: "/provisioning/webhooks/",
  },

  reports: {
    definitions: "/reports/definitions/",
    filters: "/reports/filters/",
    instances: "/reports/instances/",
    metrics: "/reports/metrics/",
    widgets: "/reports/widgets/",
    financialRevenueByGateway: "/reports/financial/revenue_by_gateway/",
    financialRevenueByProduct: "/reports/financial/revenue_by_product/",
    financialRevenueSummary: "/reports/financial/revenue_summary/",
    businessSnapshot: "/reports/business-intelligence/",
  },

  services: {
    services: "/services/services/",
    changeRequests: "/services/change-requests/",
  },

  settings: {
    groups: "/settings/groups/",
    settings: "/settings/settings/",
    branding: "/settings/branding/",
    system: "/settings/system/",
    tax: "/settings/tax/",
    emailTemplates: "/settings/email-templates/",
  },

  support: {
    departments: "/support/departments/",
    escalationRules: "/support/escalation-rules/",
    predefinedResponses: "/support/predefined-responses/",
    tickets: "/support/tickets/",
  },
} as const;

export function byId(basePath: string, id: string | number) {
  return `${basePath}${encodeURIComponent(String(id))}/`;
}

export function actionPath(basePath: string, action: string) {
  return `${basePath}${action}/`;
}
