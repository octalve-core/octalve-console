import type { ResourceStatus } from "@/lib/api/types";
import type { AdminResourceKey } from "./admin-resource-config";

export type AdminFieldType = "text" | "email" | "number" | "date" | "textarea" | "select";

export type AdminEditorField = {
  name: string;
  label: string;
  type: AdminFieldType;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
};

export type AdminEditorConfig = {
  key: AdminResourceKey;
  listHref: string;
  newHref?: string;
  detailLabel: string;
  createTitle: string;
  editTitle: string;
  description: string;
  fields: AdminEditorField[];
};

export const statusOptions: Array<{ label: ResourceStatus | string; value: ResourceStatus | string }> = [
  { label: "active", value: "Active" },
  // { label: "Pending", value: "Pending" },
  { label: "Inactive", value: "Inactive" },
  // { label: "Suspended", value: "Suspended" },
  // { label: "Cancelled", value: "Cancelled" },
  // { label: "Draft", value: "Draft" },
  // { label: "Paid", value: "Paid" },
  // { label: "Unpaid", value: "Unpaid" },
  // { label: "Planned", value: "Planned" },
  { label: "Test Mode", value: "test" },
];

export const adminEditorConfig = {
  customers: {
    key: "customers",
    listHref: "/admin/customers",
    newHref: "/admin/customers/new",
    detailLabel: "Customer profile",
    createTitle: "Add customer",
    editTitle: "Edit customer",
    description: "Create or update a customer record for hosting, billing, and support access.",
    fields: [
      { name: "name", label: "Customer name", type: "text", placeholder: "Customer name", required: true },
      { name: "email", label: "Email address", type: "email", placeholder: "client@example.com", required: true },
      { name: "phone", label: "Phone number", type: "text", placeholder: "+234...", required: false },
      { name: "balance", label: "Balance", type: "text", placeholder: "â‚¦0", required: false },
      { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
    ],
  },
  products: {
    key: "products",
    listHref: "/admin/products",
    newHref: "/admin/products/new",
    detailLabel: "Product profile",
    createTitle: "Add product",
    editTitle: "Edit product",
    description: "Manage a hosting product, adapter, category, and product visibility.",
    fields: [
      { name: "name", label: "Product name", type: "text", placeholder: "Web Hosting", required: true },
      { name: "category", label: "Category", type: "text", placeholder: "Hosting", required: true },
      { name: "adapter", label: "Adapter", type: "text", placeholder: "directadmin", required: true },
      { name: "description", label: "Description", type: "textarea", placeholder: "Describe this product", required: false },
      { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
    ],
  },
  plans: {
    key: "plans",
    listHref: "/admin/plans",
    newHref: "/admin/plans/new",
    detailLabel: "Plan profile",
    createTitle: "Add plan",
    editTitle: "Edit plan",
    description: "Manage pricing, billing cycle, resource limits, and package availability.",
    fields: [
      { name: "name", label: "Plan name", type: "text", placeholder: "Business", required: true },
      { name: "product", label: "Product", type: "text", placeholder: "Web Hosting", required: true },
      { name: "price", label: "Price", type: "number", placeholder: "3500", required: true },
      { name: "currency", label: "Currency", type: "text", placeholder: "NGN", required: true },
      { name: "cycle", label: "Billing cycle", type: "text", placeholder: "monthly", required: true },
      { name: "storage", label: "Storage", type: "text", placeholder: "10GB SSD", required: false },
      { name: "bandwidth", label: "Bandwidth", type: "text", placeholder: "100GB", required: false },
      { name: "adapter", label: "Adapter", type: "text", placeholder: "directadmin", required: false },
      { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
    ],
  },
  orders: {
    key: "orders",
    listHref: "/admin/orders",
    newHref: "/admin/orders/new",
    detailLabel: "Order profile",
    createTitle: "Create order",
    editTitle: "Edit order",
    description: "Create or update a customer order before provisioning and invoicing.",
    fields: [
      { name: "customer", label: "Customer", type: "text", placeholder: "Customer ID or name", required: true },
      { name: "product", label: "Product", type: "text", placeholder: "Web Hosting", required: true },
      { name: "total", label: "Total", type: "number", placeholder: "3500", required: true },
      { name: "date", label: "Order date", type: "date", required: false },
      { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
    ],
  },
  invoices: {
    key: "invoices",
    listHref: "/admin/billing/invoices",
    newHref: "/admin/billing/invoices/new",
    detailLabel: "Invoice profile",
    createTitle: "Create invoice",
    editTitle: "Edit invoice",
    description: "Create or update billing records connected to orders, customers, and payment status.",
    fields: [
      { name: "client", label: "Client", type: "text", placeholder: "Client name or ID", required: true },
      { name: "total", label: "Total", type: "number", placeholder: "3500", required: true },
      { name: "paid", label: "Paid amount", type: "number", placeholder: "0", required: false },
      { name: "due", label: "Due amount", type: "number", placeholder: "3500", required: false },
      { name: "date", label: "Invoice date", type: "date", required: false },
      { name: "dueDate", label: "Due date", type: "date", required: false },
      { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
    ],
  },
  domains: {
    key: "domains",
    listHref: "/admin/billing/domains",
    newHref: "/admin/billing/domains/new",
    detailLabel: "Domain profile",
    createTitle: "Add domain",
    editTitle: "Edit domain",
    description: "Manage domain ownership, registrar, expiry, price, and renewal settings.",
    fields: [
      { name: "domain", label: "Domain", type: "text", placeholder: "example.com", required: true },
      { name: "client", label: "Client", type: "text", placeholder: "Client name or ID", required: true },
      { name: "registrar", label: "Registrar", type: "text", placeholder: "Registrar API", required: false },
      { name: "price", label: "Price", type: "number", placeholder: "14500", required: false },
      { name: "renewal", label: "Renewal", type: "text", placeholder: "Auto-renew ready", required: false },
      { name: "expiry", label: "Expiry date", type: "date", required: false },
      { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
    ],
  },
  gateways: {
    key: "gateways",
    listHref: "/admin/gateways",
    newHref: "/admin/gateways/new",
    detailLabel: "Gateway profile",
    createTitle: "Add gateway",
    editTitle: "Edit gateway",
    description: "Configure payment gateways like Paystack, Flutterwave, wallet, and bank transfer.",
    fields: [
      { name: "name", label: "Gateway name", type: "text", placeholder: "Paystack", required: true },
      { name: "display_name", label: "Display name", type: "text", placeholder: "Paystack", required: true },
      { name: "public_key", label: "Public key", type: "text", placeholder: "pk_test_...", required: false },
      { name: "secret_key", label: "Secret key", type: "text", placeholder: "sk_test_...", required: false },
      { name: "webhook_secret", label: "Webhook secret", type: "text", placeholder: "Optional", required: false },
      { name: "summary", label: "Summary", type: "textarea", placeholder: "Describe gateway usage", required: false },
      { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
    ],
  },
  providers: {
    key: "providers",
    listHref: "/admin/servers",
    newHref: "/admin/servers/new",
    detailLabel: "Provider profile",
    createTitle: "Add provider",
    editTitle: "Edit provider",
    description: "Connect infrastructure providers like DirectAdmin, cPanel, VPS, and registrar APIs.",
    fields: [
      { name: "name", label: "Provider name", type: "text", placeholder: "DirectAdmin Node 1", required: true },
      { name: "adapter_type", label: "Adapter type", type: "text", placeholder: "directadmin", required: true },
      { name: "base_url", label: "Base URL", type: "text", placeholder: "https://opanel.octalve.cloud", required: false },
      { name: "username", label: "Username", type: "text", placeholder: "API username", required: false },
      { name: "api_key", label: "API key", type: "text", placeholder: "API key", required: false },
      { name: "secret", label: "Secret", type: "text", placeholder: "Optional secret", required: false },
      { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
    ],
  },
  provisioning: {
    key: "provisioning",
    listHref: "/admin/provisioning",
    newHref: "/admin/provisioning/run",
    detailLabel: "Provisioning task",
    createTitle: "Create provisioning task",
    editTitle: "Edit provisioning task",
    description: "Create or update automation tasks for services, domains, providers, and billing actions.",
    fields: [
      { name: "title", label: "Task title", type: "text", placeholder: "Create hosting account", required: true },
      { name: "service", label: "Service", type: "text", placeholder: "Service ID or domain", required: false },
      { name: "provider", label: "Provider", type: "text", placeholder: "DirectAdmin Node 1", required: false },
      { name: "action", label: "Action", type: "text", placeholder: "provision", required: true },
      { name: "priority", label: "Priority", type: "select", required: false, options: [
        { label: "Low", value: "low" },
        { label: "Normal", value: "normal" },
        { label: "High", value: "high" },
      ] },
      { name: "status", label: "Status", type: "select", required: true, options: statusOptions },
    ],
  },
} satisfies Record<AdminResourceKey, AdminEditorConfig>;