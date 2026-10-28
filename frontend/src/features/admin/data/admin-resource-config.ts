import { adminApi } from "@/lib/api/endpoints";
import { schemaApi } from "@/lib/api/schema-api";
import { getFallbackData } from "@/lib/config/data-source";
import { adminDemo, type AdminRecord } from "./admin-demo-data";

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

export type AdminResourceConfig = {
  key: AdminResourceKey;
  eyebrow: string;
  title: string;
  description: string;
  createHref?: string;
  createLabel?: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  fallback: AdminRecord[];
  loader: () => Promise<unknown>;
};

export const adminResourceConfig: Record<AdminResourceKey, AdminResourceConfig> = {
  customers: {
    key: "customers",
    eyebrow: "Customers",
    title: "Customers",
    description: "Manage client accounts, balances, statuses, and service ownership.",
    createHref: "/admin/customers/new",
    createLabel: "Add customer",
    searchPlaceholder: "Search customers by name or email...",
    emptyTitle: "No customers found",
    emptyDescription: "Customer records will appear here when available.",
    fallback: getFallbackData(adminDemo.customers),
    loader: () => adminApi.customers(),
  },
  products: {
    key: "products",
    eyebrow: "Catalog",
    title: "Products",
    description: "Review product identity, type and visibility. Create or revise products in Catalogue.",
    createHref: "/admin/catalog/workbench",
    createLabel: "Manage in Catalogue",
    searchPlaceholder: "Search products...",
    emptyTitle: "No products found",
    emptyDescription: "Products from the catalog API will appear here.",
    fallback: getFallbackData(adminDemo.products),
    loader: () => schemaApi.catalog.products(),
  },
  plans: {
    key: "plans",
    eyebrow: "Catalog",
    title: "Plans",
    description: "Review published plans and billing cycles. Revise retail prices only through reviewed Catalogue offer drafts.",
    createHref: "/admin/catalog/workbench",
    createLabel: "Draft in Catalogue",
    searchPlaceholder: "Search plans...",
    emptyTitle: "No plans found",
    emptyDescription: "Plans from the catalog API will appear here.",
    fallback: getFallbackData(adminDemo.plans),
    loader: () => schemaApi.catalog.plans(),
  },
  orders: {
    key: "orders",
    eyebrow: "Commerce",
    title: "Orders",
    description: "Review customer purchases, provisioning status, invoice links, and order actions.",
    // Orders are issued only by the verified checkout workflow.
    searchPlaceholder: "Search orders...",
    emptyTitle: "No orders found",
    emptyDescription: "Order records will appear here when available.",
    fallback: getFallbackData(adminDemo.orders),
    loader: () => schemaApi.orders.orders(),
  },
  invoices: {
    key: "invoices",
    eyebrow: "Billing",
    title: "Invoices",
    description: "Review customer invoices and their verified states. Invoice design is managed separately.",
    // Invoice issuance is server-controlled; designer is a separate read-only workspace.
    searchPlaceholder: "Search invoices...",
    emptyTitle: "No invoices found",
    emptyDescription: "Invoices from the billing API will appear here.",
    fallback: getFallbackData(adminDemo.invoices),
    loader: () => schemaApi.billing.invoices(),
  },
  domains: {
    key: "domains",
    eyebrow: "Domains",
    title: "Domains",
    description: "Manage registrations, renewals, nameservers, DNS, SSL and domain ownership.",
    // Domain registrar activation is not accepted yet.
    searchPlaceholder: "Search domains...",
    emptyTitle: "No domains found",
    emptyDescription: "Domains from the domain API will appear here.",
    fallback: getFallbackData(adminDemo.domains),
    loader: () => schemaApi.domains.domains(),
  },
  gateways: {
    key: "gateways",
    eyebrow: "Payments",
    title: "Gateways",
    description: "Review gateway records. Secure connections are prepared in Integrations; live payment activation requires approval.",
    // Payment gateway connections belong to Integrations, never generic CRUD.
    searchPlaceholder: "Search gateways...",
    emptyTitle: "No gateways found",
    emptyDescription: "Payment gateways from the backend will appear here.",
    fallback: getFallbackData(adminDemo.gateways),
    loader: () => schemaApi.payments.gateways(),
  },
  providers: {
    key: "providers",
    eyebrow: "Infrastructure",
    title: "Providers",
    description: "Connect DirectAdmin, cPanel, VPS providers, registrars, and provisioning adapters.",
    createHref: "/admin/integrations",
    createLabel: "Browse integrations",
    searchPlaceholder: "Search providers...",
    emptyTitle: "No providers found",
    emptyDescription: "Provider adapters from the backend will appear here.",
    fallback: getFallbackData(adminDemo.providers),
    loader: () => schemaApi.providers.providers(),
  },
  provisioning: {
    key: "provisioning",
    eyebrow: "Automation",
    title: "Provisioning",
    description: "Review provisioning task status and operational history. Execution and provider-changing retries are unavailable.",
    // No public HTTP provisioning executor exists.
    searchPlaceholder: "Search provisioning tasks...",
    emptyTitle: "No provisioning tasks found",
    emptyDescription: "Provisioning queue items from the backend will appear here.",
    fallback: getFallbackData(adminDemo.provisioning),
    loader: () => schemaApi.provisioning.tasks(),
  },
};