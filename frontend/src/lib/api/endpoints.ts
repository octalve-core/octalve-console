// src/lib/api/endpoints.ts

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
  WalletBalance,
} from "./types";

export type AccountProfile = {
  email: string; email_verified: boolean; full_name: string;
  phone_number: string; company_name: string; address: string;
  city: string; state: string; country: string; postal_code: string; tax_id: string;
};
export type CheckoutQuote = {
  currency: string; subtotal: string; discount_total: string; tax_total:string;
  total:string; coupon_code:string|null;
  items: {name:string;description:string;domain_name:string;quantity:number;
    unit_price:string;cycle_key:string;price_revision:number|null}[];
  message:string;
};
export type CheckoutOptions = {enabled:boolean;gateways:string[];currency:string};
export type ServiceRenewalStatus = {
  service_id:number;state:"invoice_ready"|"request_assistance"|"unavailable";
  invoice_id:number|null;auto_renew:boolean;next_due_date:string;
};
export type DomainRenewalStatus = {
  domain_id:number;state:"invoice_ready"|"request_assistance"|"unavailable";
  invoice_id:number|null;auto_renew:boolean;registration_date:string;
  expiry_date:string;next_due_date:string;
};
export type DomainTransferReadiness = {
  domain:string;tld:string|null;supported:boolean;registrar_connected:boolean;
  transfer_eligible:boolean|null;checkout_enabled:boolean;
  state:"registrar_verification_required";
  indicative_price:string|null;currency:string|null;message:string;
};
export type CustomerNotice = {
  key:string;kind:"invoice"|"domain";severity:"urgent"|"attention";
  title:string;description:string;date:string;href:string;read:boolean;
};
export type CustomerNoticePreferences = {
  show_login_alerts:boolean;invoice_alerts:boolean;domain_alerts:boolean;
};
export type CustomerNoticeInbox = {
  items:CustomerNotice[];unread_count:number;
  preferences:CustomerNoticePreferences;
  delivery:{in_app:boolean;email_reminders_enabled:boolean};
};
export type CustomerCommunityLinks = {
  links:{whatsapp:string|null;telegram:string|null};
  automatic_enrollment:boolean;
};
export type EditableAccountProfile = Omit<AccountProfile,"email"|"email_verified">;

type ListParams = {
  search?: string;
  status?: string;
  page?: number;
  page_size?: number;
};

const byId = (base: string, id: string) => `${base.replace(/\/+$/, "")}/${encodeURIComponent(id)}/`;

export const apiPaths = {
  auth: {
    login: "/auth/jwt/create/",
    signup: "/auth/register/",
    logout: "/auth/logout/",
    me: "/auth/users/me/",
    refresh: "/auth/jwt/refresh/",
    verify: "/auth/jwt/verify/",
    resetPassword: "/auth/users/reset_password/",
    resetPasswordConfirm: "/auth/users/reset_password_confirm/",
    setPassword: "/auth/users/set_password/",
  },

  public: {
    plans: "/catalog/plans/",
    categories: "/storefront/categories/",
    products: "/catalog/products/",
    knowledgeBase: "/knowledge-base/",
  },

  client: {
    // dashboard: "/client/dashboard/",
    // services: "/client/services/",
    // domains: "/client/domains/",
    // invoices: "/client/invoices/",
    // orders: "/client/orders/",
    // wallet: "/client/wallet/",
    // tickets: "/support/tickets/",
    // knowledgeBase: "/client/knowledge-base/",
    
    dashboard: "/dashboard/",
    services: "/services/services/",
    domains: "/domains/domains/",
    invoices: "/billing/invoices/",
    orders: "/orders/orders/",
    wallet: "/wallet/my-wallet/me/",
    tickets: "/support/tickets/",
    knowledgeBase: "/knowledge-base/",
    notices: "/notifications/",
  },

  admin: {
    customers: "/auth/customers/",
    // customers: "/admin/customers/",
    products: "/catalog/products/",
    plans: "/catalog/plans/",
    orders: "/orders/orders/",
    services: "/services/services/",
    invoices: "/billing/invoices/",
    transactions: "/payments/transactions/",
    domains: "/domains/domains/",
    gateways: "/payments/gateways/",
    providers: "/providers/providers/",
    settings: "/settings/settings/",
    apiKeys: "/admin/api-keys/",
    notificationTemplates: "/settings/email-templates/",
    tickets: "/support/tickets/",
    knowledgeBase: "/knowledge-base/",
    auditLogs: "/audit/logs/",
    reports: "/reports/definitions/",
    provisioningQueue: "/provisioning/tasks/",
  },
};

export const authApi = {
  profile() { return api.get<AccountProfile>("/auth/profile/"); },
  saveProfile(details: Partial<EditableAccountProfile>) {
    return api.patch<AccountProfile>("/auth/profile/", details);
  },
  requestEmailVerification() {
    return api.post<{detail?:string;email_verified?:boolean}>("/auth/email/verification/request/", {});
  },
  confirmEmailVerification(token:string) {
    return api.post<{email_verified:boolean}>("/auth/email/verification/confirm/",{token},{skipAuth:true});
  },
  login(payload: LoginPayload) {
    return api.post<AuthSession>(apiPaths.auth.login, payload, {
      skipAuth: true,
    });
  },

  signup(payload: SignupPayload) {
    const signupData = {
      full_name: payload.full_name,
      email: payload.email,
      username: payload.email.split("@")[0],
      phone_number: payload.phone || "",
      referral_code: payload.referral_code || "",
      password: payload.password,
      re_password: payload.password,
    };

    return api.post<AuthSession>(apiPaths.auth.signup, signupData, {
      skipAuth: true,
    });
  },

  logout() {
    // The server reads the refresh cookie. Never pass refresh JWTs in JS.
    return api.post<{ ok?: boolean }>(apiPaths.auth.logout, {});
  },

  me() {
    return api.get<User>(apiPaths.auth.me);
  },

  requestPasswordReset(email: string) {
    return api.post<{ detail?: string }>(
      apiPaths.auth.resetPassword,
      { email },
      { skipAuth: true },
    );
  },

  confirmPasswordReset(uid: string, token: string, newPassword: string) {
    // Djoser expects uid and token in the BODY, not in the URL path
    const payload = {
      uid: String(uid).trim(),
      token: String(token).trim(),
      new_password: String(newPassword),
      re_new_password: String(newPassword),
    };

    

    // Use the exact endpoint without adding uid/token to URL
    return api.post(apiPaths.auth.resetPasswordConfirm, payload, {
      skipAuth: true,
    });
  },

  changePassword(currentPassword: string, newPassword: string) {
    return api.post(apiPaths.auth.setPassword, {
      current_password: currentPassword,
      new_password: newPassword,
      re_new_password: newPassword,
    });
  },
};

export type PublishedServiceCategory = {slug: string;name: string;description: string};

export const publicApi = {
  publishedCategories() {
    return api.get<{categories: PublishedServiceCategory[]}>(apiPaths.public.categories);
  },
  products(params?: ListParams) {
    return api.get<PaginatedResponse<Product> | Product[]>(
      apiPaths.public.products,
      {
        params,
      },
    );
  },

  plans(params?: ListParams) {
    return api.get<PaginatedResponse<Plan> | Plan[]>(apiPaths.public.plans, {
      params,
    });
  },

  knowledgeBase(params?: ListParams) {
    return api.get<
      PaginatedResponse<KnowledgeBaseArticle> | KnowledgeBaseArticle[]
    >(apiPaths.public.knowledgeBase, { params });
  },
};

export const clientApi = {
  notices() {
    return api.get<CustomerNoticeInbox>(apiPaths.client.notices+"inbox/");
  },
  markNoticeRead(key:string) {
    return api.post<{key:string;read:boolean}>(apiPaths.client.notices+"read/",{key});
  },
  noticePreferences() {
    return api.get<CustomerNoticePreferences>(apiPaths.client.notices+"preferences/");
  },
  updateNoticePreferences(prefs:Partial<CustomerNoticePreferences>) {
    return api.patch<CustomerNoticePreferences>(apiPaths.client.notices+"preferences/",prefs);
  },
  community() {
    return api.get<CustomerCommunityLinks>(apiPaths.client.notices+"community/");
  },
  // The customer overview is assembled from independently authorized resource reads.

  services(params?: ListParams) {
    return api.get<PaginatedResponse<Service> | Service[]>(
      apiPaths.client.services,
      {
        params,
      },
    );
  },

  service(id: string) {
    return api.get<Service>(byId(apiPaths.client.services, id));
  },
  serviceRenewalStatus(id: string) {
    return api.get<ServiceRenewalStatus>(byId(apiPaths.client.services, id)+"renewal-status/");
  },

  serviceAction(
    id: string,
    action:
      | "reboot"
      | "start"
      | "stop"
      | "request_migration"
      | "change_password",
    payload?: unknown,
  ) {
    return api.post(
      byId(apiPaths.client.services, id) + `${action}/`,
      payload || {},
    );
  },

  domains(params?: ListParams) {
    return api.get<PaginatedResponse<Domain> | Domain[]>(
      apiPaths.client.domains,
      {
        params,
      },
    );
  },

  domain(id: string) {
    return api.get<Domain>(byId(apiPaths.client.domains, id));
  },
  domainRenewalStatus(id:string) {
    return api.get<DomainRenewalStatus>(
      byId(apiPaths.client.domains,id)+"renewal-status/");
  },
  domainTransferReadiness(domain:string) {
    return api.get<DomainTransferReadiness>(
      apiPaths.client.domains+"transfer-readiness/",{params:{domain}});
  },

  domainDnsRecords(id: string) {
    return api.get(byId(apiPaths.client.domains, id) + "dns_records/");
  },

  createDomainDnsRecord(id: string, payload: unknown) {
    return api.post(
      byId(apiPaths.client.domains, id) + "dns_records/",
      payload,
    );
  },

  updateDomainDnsRecord(_id: string, _recordId: string, _payload: unknown): Promise<never> {
    return Promise.reject(new Error("DNS record editing requires a verified DNS provider."));
  },

  deleteDomainDnsRecord(id: string, recordId: string) {
    return api.post(byId(apiPaths.client.domains, id) + "delete_dns_record/", {
      record_id: recordId,
    });
  },

  updateDomainNameservers(id: string, payload: unknown) {
    return api.post(
      byId(apiPaths.client.domains, id) + "update_nameservers/",
      payload,
    );
  },

  renewDomain(id: string, payload?: unknown) {
    return api.post(
      byId(apiPaths.client.domains, id) + "renew/",
      payload || {},
    );
  },

  invoices(params?: ListParams) {
    return api.get<PaginatedResponse<Invoice> | Invoice[]>(
      apiPaths.client.invoices,
      {
        params,
      },
    );
  },

  invoice(id: string) {
    return api.get<Invoice>(byId(apiPaths.client.invoices, id));
  },

  orders(params?: ListParams) {
    return api.get<PaginatedResponse<Order> | Order[]>(apiPaths.client.orders, {
      params,
    });
  },

  quoteOrder(payload: {
    checkout_id:string;
    items:{plan_id:number;offer_revision?:number;cycle_key:string;quantity:number;domain_name:string}[];
    coupon_code?:string;
  }) {
    return api.post<CheckoutQuote>(apiPaths.client.orders + "quote/", payload);
  },

  createOrder(payload: unknown) {
    return api.post<Order>(apiPaths.client.orders, payload);
  },

  checkoutOptions() {
    return api.get<CheckoutOptions>("/payments/checkout-options/");
  },
  paymentStatus(invoiceId:number) {
    return api.get<{invoice_id:number;invoice_status:string;amount_due:string;currency:string}>(
      "/payments/verify/", {params:{invoice_id:invoiceId}});
  },
  initializeHostedPayment(invoiceId:number,gateway:"paystack"|"flutterwave") {
    return api.post<{checkout_url:string;invoice_id:number;status:string}>(
      "/payments/initialize/",{invoice_id:invoiceId,gateway});
  },
  async wallet(): Promise<WalletBalance> {
    // Django's wallet/my-wallet/me/ serializer returns `balance` as a
    // decimal string, not the old frontend-only `available` property.
    // Never fabricate a zero when the response is absent or invalid.
    const record = await api.get<{balance?: unknown;currency?: unknown}>(apiPaths.client.wallet);
    const raw = record?.balance;
    if (typeof raw !== "string" && typeof raw !== "number") {
      throw new Error("Wallet balance response is unavailable.");
    }
    const amountText = String(raw);
    if (!/^\d+(?:\.\d{1,2})?$/.test(amountText) ||
        !Number.isFinite(Number(amountText)) || Number(amountText) < 0 ||
        typeof record.currency !== "string" || !/^[A-Z]{3}$/.test(record.currency)) {
      throw new Error("Wallet balance response is invalid.");
    }
    return { available: Number(amountText), currency: record.currency };
  },

  fundWallet(_payload: unknown): Promise<never> {
    // No authorized customer top-up endpoint is connected yet.
    return Promise.reject(new Error("Wallet funding is not yet available."));
  },

  tickets(params?: ListParams) {
    return api.get<PaginatedResponse<SupportTicket> | SupportTicket[]>(
      apiPaths.client.tickets,
      { params },
    );
  },

  createTicket(payload: unknown) {
    return api.post<SupportTicket>(apiPaths.client.tickets, payload);
  },

  replyTicket(id: string, payload: unknown) {
    return api.post(byId(apiPaths.client.tickets, id) + "reply/", payload);
  },
};

export const adminApi = {
  customers(params?: ListParams) {
    return api.get<PaginatedResponse<Customer> | Customer[]>(
      apiPaths.admin.customers,
      {
        params,
      },
    );
  },

  createCustomer(payload: Partial<Customer>) {
    return api.post<Customer>(apiPaths.admin.customers, payload);
  },

  updateCustomer(id: string, payload: Partial<Customer>) {
    return api.patch<Customer>(byId(apiPaths.admin.customers, id), payload);
  },

  products(params?: ListParams) {
    return api.get<PaginatedResponse<Product> | Product[]>(
      apiPaths.admin.products,
      {
        params,
      },
    );
  },

  createProduct(payload: Partial<Product>) {
    return api.post<Product>(apiPaths.admin.products, payload);
  },

  updateProduct(id: string, payload: Partial<Product>) {
    return api.patch<Product>(byId(apiPaths.admin.products, id), payload);
  },

  plans(params?: ListParams) {
    return api.get<PaginatedResponse<Plan> | Plan[]>(apiPaths.admin.plans, {
      params,
    });
  },

  createPlan(payload: Partial<Plan>) {
    return api.post<Plan>(apiPaths.admin.plans, payload);
  },

  updatePlan(id: string, payload: Partial<Plan>) {
    return api.patch<Plan>(byId(apiPaths.admin.plans, id), payload);
  },

  orders(params?: ListParams) {
    return api.get<PaginatedResponse<Order> | Order[]>(apiPaths.admin.orders, {
      params,
    });
  },

  updateOrder(id: string, payload: Partial<Order>) {
    return api.patch<Order>(byId(apiPaths.admin.orders, id), payload);
  },

  services(params?: ListParams) {
    return api.get<PaginatedResponse<Service> | Service[]>(
      apiPaths.admin.services,
      {
        params,
      },
    );
  },

  runServiceAction(
    id: string,
    action: "provision" | "suspend" | "unsuspend" | "terminate" | "renew",
    payload?: unknown,
  ) {
    return api.post(
      byId(apiPaths.admin.services, id) + `${action}/`,
      payload || {},
    );
  },

  invoices(params?: ListParams) {
    return api.get<PaginatedResponse<Invoice> | Invoice[]>(
      apiPaths.admin.invoices,
      {
        params,
      },
    );
  },

  transactions(params?: ListParams) {
    return api.get<PaginatedResponse<Transaction> | Transaction[]>(
      apiPaths.admin.transactions,
      { params },
    );
  },

  domains(params?: ListParams) {
    return api.get<PaginatedResponse<Domain> | Domain[]>(
      apiPaths.admin.domains,
      {
        params,
      },
    );
  },

  gateways(params?: ListParams) {
    return api.get<PaginatedResponse<Gateway> | Gateway[]>(
      apiPaths.admin.gateways,
      {
        params,
      },
    );
  },

  updateGateway(id: string, payload: GatewayConfigPayload) {
    return api.patch<Gateway>(byId(apiPaths.admin.gateways, id), payload);
  },

  providers(params?: ListParams) {
    return api.get<PaginatedResponse<Provider> | Provider[]>(
      apiPaths.admin.providers,
      {
        params,
      },
    );
  },

  createProvider(payload: ProviderConfigPayload) {
    return api.post<Provider>(apiPaths.admin.providers, payload);
  },

  updateProvider(id: string, payload: Partial<ProviderConfigPayload>) {
    return api.patch<Provider>(byId(apiPaths.admin.providers, id), payload);
  },

  testProvider(id: string) {
    return api.post(
      byId(apiPaths.admin.providers, id) + "test-connection/",
      {},
    );
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
    return api.get<PaginatedResponse<SupportTicket> | SupportTicket[]>(
      apiPaths.admin.tickets,
      { params },
    );
  },

  knowledgeBase(params?: ListParams) {
    return api.get<
      PaginatedResponse<KnowledgeBaseArticle> | KnowledgeBaseArticle[]
    >(apiPaths.admin.knowledgeBase, { params });
  },

  auditLogs(params?: ListParams) {
    return api.get<PaginatedResponse<AuditLog> | AuditLog[]>(
      apiPaths.admin.auditLogs,
      {
        params,
      },
    );
  },

  reports(params?: ListParams) {
    return api.get(apiPaths.admin.reports, { params });
  },

  provisioningQueue(params?: ListParams) {
    return api.get(apiPaths.admin.provisioningQueue, { params });
  },

  runProvisioningTask(id: string) {
    return api.post(byId(apiPaths.admin.provisioningQueue, id) + "run/", {});
  },
};

