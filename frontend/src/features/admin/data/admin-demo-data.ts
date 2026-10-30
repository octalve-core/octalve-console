export type AdminRecord = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  reference?: string;
  companyName?: string;
  servicesCount?: number;
  dateISO?: string;
  walletBalance?: string;
  status: string;
  amount?: string;
  date?: string;
  actionHref: string;
};

export type AdminResourceKey =
  | "customers"
  | "products"
  | "plans"
  | "orders"
  | "invoices"
  | "domains"
  | "gateways"
  | "providers"
  | "provisioning";

export const adminDemo: Record<AdminResourceKey, AdminRecord[]> = {
  customers: [],
  products: [],
  plans: [],
  orders: [],
  invoices: [],
  domains: [],
  gateways: [],
  providers: [],
  provisioning: [],
};