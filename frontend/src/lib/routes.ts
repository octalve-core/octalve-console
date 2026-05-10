export const routes = {
  home: "/",

  auth: {
    login: "/login",
    signup: "/signup",
    forgotPassword: "/forgot-password",
  },

  admin: {
    root: "/admin",
    customers: "/admin/customers",
    products: "/admin/products",
    plans: "/admin/plans",
    orders: "/admin/orders",
    billing: "/admin/billing",
    invoices: "/admin/billing/invoices",
    transactions: "/admin/billing/transactions",
    domains: "/admin/billing/domains",
    services: "/admin/billing/services",
    gateways: "/admin/gateways",
    providers: "/admin/servers",
    provisioning: "/admin/provisioning",
    support: "/admin/support",
    knowledgeBase: "/admin/knowledge-base",
    settings: "/admin/settings",
  },

  client: {
    root: "/client",
    services: "/client/services",
    domains: "/client/domains",
    invoices: "/client/invoices",
    orders: "/client/orders",
    order: "/client/order",
    checkout: "/client/order/checkout",
    wallet: "/client/wallet",
    support: "/client/support",
    profile: "/client/profile",
    knowledgeBase: "/client/knowledge-base",
  },

  staff: {
    root: "/staff",
    customers: "/staff/customers",
    orders: "/staff/orders",
    provisioning: "/staff/provisioning",
    tickets: "/staff/tickets",
    knowledgeBase: "/staff/knowledge-base",
  },
} as const;
