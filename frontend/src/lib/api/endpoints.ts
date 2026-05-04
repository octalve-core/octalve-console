import { api } from "./client";
import type {
  ApiKeyPayload,
  AuditLog,
  AuthSession,
  Customer,
  Domain,
  Gateway,
  GatewayConfigPayload,
  Invoice,
  KnowledgeBaseArticle,
  LoginPayload,
  Order,
  PaginatedResponse,
  Plan,
  Product,
  Provider,
  ProviderConfigPayload,
  Service,
  SignupPayload,
  SupportTicket,
  Transaction,
  User,
  WalletBalance
} from "./types";

type ListParams = {
  search?: string;
  status?: string;
  page?: number;
  page_size?: number;
};

const byId = (base: string, id: string) => `${base}/${encodeURIComponent(id)}/`;

export const apiPaths = {
  auth: {
    login: "/auth/login/",
    signup: "/auth/signup/",
    logout: "/auth/logout/",
    me: "/auth/me/"
  },

  public: {
    plans: "/catalog/plans/",
    products: "/catalog/products/",
    knowledgeBase: "/knowledge-base/"
  },

  client: {
    dashboard: "/client/dashboard/",
    services: "/client/services/",
    domains: "/client/domains/",
    invoices: "/client/invoices/",
    orders: "/client/orders/",
    wallet: "/client/wallet/",
    tickets: "/client/support/tickets/",
    knowledgeBase: "/client/knowledge-base/"
  },

  admin: {
    customers: "/admin/customers/",
    products: "/admin/products/",
    plans: "/admin/plans/",
    orders: "/admin/orders/",
    services: "/admin/services/",
    invoices: "/admin/invoices/",
    transactions: "/admin/transactions/",
    domains: "/admin/domains/",
    gateways: "/admin/gateways/",
    providers: "/admin/providers/",
    settings: "/admin/settings/",
    apiKeys: "/admin/api-keys/",
    notificationTemplates: "/admin/notification-templates/",
    tickets: "/admin/support/tickets/",
    knowledgeBase: "/admin/knowledge-base/",
    auditLogs: "/admin/audit-logs/",
    reports: "/admin/reports/",
    provisioningQueue: "/admin/provisioning/queue/"
  }
};

export const authApi = {
  login(payload: LoginPayload) {
    return api.post<AuthSession>(apiPaths.auth.login, payload, { skipAuth: true });
  },

  signup(payload: SignupPayload) {
    return api.post<AuthSession>(apiPaths.auth.signup, payload, { skipAuth: true });
  },

  logout() {
    return api.post<{ message: string }>(apiPaths.auth.logout);
  },

  me() {
    return api.get<User>(apiPaths.auth.me);
  }
};

export const publicApi = {
  products(params?: ListParams) {
    return api.get<PaginatedResponse<Product> | Product[]>(apiPaths.public.products, { params });
  },

  plans(params?: ListParams) {
    return api.get<PaginatedResponse<Plan> | Plan[]>(apiPaths.public.plans, { params });
  },

  knowledgeBase(params?: ListParams) {
    return api.get<PaginatedResponse<KnowledgeBaseArticle> | KnowledgeBaseArticle[]>(
      apiPaths.public.knowledgeBase,
      { params }
    );
  }
};

export const clientApi = {
  dashboard() {
    return api.get(apiPaths.client.dashboard);
  },

  services(params?: ListParams) {
    return api.get<PaginatedResponse<Service> | Service[]>(apiPaths.client.services, { params });
  },

  service(id: string) {
    return api.get<Service>(byId(apiPaths.client.services, id));
  },

  serviceAction(id: string, action: "reboot" | "start" | "stop" | "request_migration" | "change_password", payload?: unknown) {
    return api.post(byId(apiPaths.client.services, id) + `${action}/`, payload || {});
  },

  domains(params?: ListParams) {
    return api.get<PaginatedResponse<Domain> | Domain[]>(apiPaths.client.domains, { params });
  },

  domain(id: string) {
    return api.get<Domain>(byId(apiPaths.client.domains, id));
  },

  domainDnsRecords(id: string) {
    return api.get(byId(apiPaths.client.domains, id) + "dns-records/");
  },

  createDomainDnsRecord(id: string, payload: unknown) {
    return api.post(byId(apiPaths.client.domains, id) + "dns-records/", payload);
  },

  updateDomainDnsRecord(id: string, recordId: string, payload: unknown) {
    return api.patch(byId(apiPaths.client.domains, id) + `dns-records/${encodeURIComponent(recordId)}/`, payload);
  },

  deleteDomainDnsRecord(id: string, recordId: string) {
    return api.del(byId(apiPaths.client.domains, id) + `dns-records/${encodeURIComponent(recordId)}/`);
  },

  updateDomainNameservers(id: string, payload: unknown) {
    return api.post(byId(apiPaths.client.domains, id) + "nameservers/", payload);
  },

  renewDomain(id: string, payload?: unknown) {
    return api.post(byId(apiPaths.client.domains, id) + "renew/", payload || {});
  },

  invoices(params?: ListParams) {
    return api.get<PaginatedResponse<Invoice> | Invoice[]>(apiPaths.client.invoices, { params });
  },

  invoice(id: string) {
    return api.get<Invoice>(byId(apiPaths.client.invoices, id));
  },

  orders(params?: ListParams) {
    return api.get<PaginatedResponse<Order> | Order[]>(apiPaths.client.orders, { params });
  },

  createOrder(payload: unknown) {
    return api.post<Order>(apiPaths.client.orders, payload);
  },

  wallet() {
    return api.get<WalletBalance>(apiPaths.client.wallet);
  },

  fundWallet(payload: unknown) {
    return api.post(apiPaths.client.wallet + "fund/", payload);
  },

  tickets(params?: ListParams) {
    return api.get<PaginatedResponse<SupportTicket> | SupportTicket[]>(apiPaths.client.tickets, { params });
  },

  createTicket(payload: unknown) {
    return api.post<SupportTicket>(apiPaths.client.tickets, payload);
  },

  replyTicket(id: string, payload: unknown) {
    return api.post(byId(apiPaths.client.tickets, id) + "reply/", payload);
  }
};

export const adminApi = {
  customers(params?: ListParams) {
    return api.get<PaginatedResponse<Customer> | Customer[]>(apiPaths.admin.customers, { params });
  },

  createCustomer(payload: Partial<Customer>) {
    return api.post<Customer>(apiPaths.admin.customers, payload);
  },

  updateCustomer(id: string, payload: Partial<Customer>) {
    return api.patch<Customer>(byId(apiPaths.admin.customers, id), payload);
  },

  products(params?: ListParams) {
    return api.get<PaginatedResponse<Product> | Product[]>(apiPaths.admin.products, { params });
  },

  createProduct(payload: Partial<Product>) {
    return api.post<Product>(apiPaths.admin.products, payload);
  },

  updateProduct(id: string, payload: Partial<Product>) {
    return api.patch<Product>(byId(apiPaths.admin.products, id), payload);
  },

  plans(params?: ListParams) {
    return api.get<PaginatedResponse<Plan> | Plan[]>(apiPaths.admin.plans, { params });
  },

  createPlan(payload: Partial<Plan>) {
    return api.post<Plan>(apiPaths.admin.plans, payload);
  },

  updatePlan(id: string, payload: Partial<Plan>) {
    return api.patch<Plan>(byId(apiPaths.admin.plans, id), payload);
  },

  orders(params?: ListParams) {
    return api.get<PaginatedResponse<Order> | Order[]>(apiPaths.admin.orders, { params });
  },

  updateOrder(id: string, payload: Partial<Order>) {
    return api.patch<Order>(byId(apiPaths.admin.orders, id), payload);
  },

  services(params?: ListParams) {
    return api.get<PaginatedResponse<Service> | Service[]>(apiPaths.admin.services, { params });
  },

  runServiceAction(id: string, action: "provision" | "suspend" | "unsuspend" | "terminate" | "renew", payload?: unknown) {
    return api.post(byId(apiPaths.admin.services, id) + `${action}/`, payload || {});
  },

  invoices(params?: ListParams) {
    return api.get<PaginatedResponse<Invoice> | Invoice[]>(apiPaths.admin.invoices, { params });
  },

  transactions(params?: ListParams) {
    return api.get<PaginatedResponse<Transaction> | Transaction[]>(apiPaths.admin.transactions, { params });
  },

  domains(params?: ListParams) {
    return api.get<PaginatedResponse<Domain> | Domain[]>(apiPaths.admin.domains, { params });
  },

  gateways(params?: ListParams) {
    return api.get<PaginatedResponse<Gateway> | Gateway[]>(apiPaths.admin.gateways, { params });
  },

  updateGateway(id: string, payload: GatewayConfigPayload) {
    return api.patch<Gateway>(byId(apiPaths.admin.gateways, id), payload);
  },

  providers(params?: ListParams) {
    return api.get<PaginatedResponse<Provider> | Provider[]>(apiPaths.admin.providers, { params });
  },

  createProvider(payload: ProviderConfigPayload) {
    return api.post<Provider>(apiPaths.admin.providers, payload);
  },

  updateProvider(id: string, payload: Partial<ProviderConfigPayload>) {
    return api.patch<Provider>(byId(apiPaths.admin.providers, id), payload);
  },

  testProvider(id: string) {
    return api.post(byId(apiPaths.admin.providers, id) + "test-connection/", {});
  },

  settings() {
    return api.get(apiPaths.admin.settings);
  },

  updateSettings(payload: unknown) {
    return api.patch(apiPaths.admin.settings, payload);
  },

  createApiKey(payload: ApiKeyPayload) {
    return api.post(apiPaths.admin.apiKeys, payload);
  },

  notificationTemplates(params?: ListParams) {
    return api.get(apiPaths.admin.notificationTemplates, { params });
  },

  tickets(params?: ListParams) {
    return api.get<PaginatedResponse<SupportTicket> | SupportTicket[]>(apiPaths.admin.tickets, { params });
  },

  knowledgeBase(params?: ListParams) {
    return api.get<PaginatedResponse<KnowledgeBaseArticle> | KnowledgeBaseArticle[]>(
      apiPaths.admin.knowledgeBase,
      { params }
    );
  },

  auditLogs(params?: ListParams) {
    return api.get<PaginatedResponse<AuditLog> | AuditLog[]>(apiPaths.admin.auditLogs, { params });
  },

  reports(params?: ListParams) {
    return api.get(apiPaths.admin.reports, { params });
  },

  provisioningQueue(params?: ListParams) {
    return api.get(apiPaths.admin.provisioningQueue, { params });
  },

  runProvisioningTask(id: string) {
    return api.post(byId(apiPaths.admin.provisioningQueue, id) + "run/", {});
  }
};

