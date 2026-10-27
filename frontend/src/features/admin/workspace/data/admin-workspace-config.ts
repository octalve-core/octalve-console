import {
  Archive,
  Banknote,
  Brush,
  Coins,
  Download,
  FileStack,
  FileText,
  Mail,
  ReceiptText,
  ServerCog,
  Settings2,
  ShieldAlert,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { adminApi } from "@/lib/api/endpoints";
import { schemaApi } from "@/lib/api/schema-api";

export type AdminWorkspaceKey =
  | "billing"
  | "billing-services"
  | "transactions"
  | "quotes"
  | "billing-batch"
  | "print-queue"
  | "invoice-designer"
  | "staff"
  | "blacklist"
  | "cms"
  | "currency"
  | "download-manager"
  | "mass-mailer"
  | "service-queue";

export type AdminWorkspaceRecord = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  status: string;
  amount?: string;
  date?: string;
  actionHref: string;
};

export type AdminWorkspaceConfig = {
  key: AdminWorkspaceKey;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  listHref: string;
  createHref?: string;
  createLabel?: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  fallback: AdminWorkspaceRecord[];
  loader: () => Promise<unknown>;
  availability?: "api" | "navigation" | "unconnected";
  editorFields?: Array<{
    name: string;
    label: string;
    type: "text" | "textarea" | "number" | "date" | "select";
    placeholder?: string;
    required?: boolean;
    options?: string[];
  }>;
};

const emptyLoader = async () => [];

const noFallbackRecords: AdminWorkspaceRecord[] = [];

export const adminWorkspaceConfig: Record<AdminWorkspaceKey, AdminWorkspaceConfig> = {
  billing: {
    key: "billing",
    eyebrow: "Billing",
    title: "Billing center",
    description: "Review billing activity, invoices, transactions and service records.",
    icon: ReceiptText,
    listHref: "/admin/billing",
    searchPlaceholder: "Search billing modules...",
    emptyTitle: "No billing modules returned by API",
    emptyDescription: "The frontend is in API-only mode. Billing modules will appear when the backend returns them.",
    fallback: noFallbackRecords,
    loader: emptyLoader,
    availability: "navigation",
  },
  "billing-services": {
    key: "billing-services",
    eyebrow: "Billing",
    title: "Service billing",
    description: "Manage billable hosting services, renewals, suspension status, and recurring charges.",
    icon: ServerCog,
    listHref: "/admin/billing/services",
    createHref: "/admin/billing/services/new",
    createLabel: "Add service",
    searchPlaceholder: "Search billable services...",
    emptyTitle: "No services returned by API",
    emptyDescription: "Billable services from the backend will appear here.",
    fallback: noFallbackRecords,
    loader: () => adminApi.services(),
    editorFields: [
      { name: "customer", label: "Customer", type: "text", placeholder: "Customer name or ID", required: true },
      { name: "label", label: "Service label", type: "text", placeholder: "Service label", required: true },
      { name: "product", label: "Product", type: "text", placeholder: "Product name", required: true },
      { name: "package", label: "Package", type: "text", placeholder: "Package name", required: true },
      { name: "term", label: "Term", type: "text", placeholder: "Monthly" },
      { name: "renews", label: "Renews", type: "date" },
      { name: "status", label: "Status", type: "select", options: ["Active", "Pending", "Suspended", "Cancelled"] },
    ],
  },
  transactions: {
    key: "transactions",
    eyebrow: "Billing",
    title: "Transactions",
    description: "Track gateway, wallet, transfer, and manual payment transactions.",
    icon: Banknote,
    listHref: "/admin/billing/transactions",
    createHref: "/admin/billing/transactions/new",
    createLabel: "Add transaction",
    searchPlaceholder: "Search transactions...",
    emptyTitle: "No transactions returned by API",
    emptyDescription: "Transactions from the backend will appear here.",
    fallback: noFallbackRecords,
    loader: () => schemaApi.payments.transactions(),
    editorFields: [
      { name: "client", label: "Client", type: "text", placeholder: "Client name", required: true },
      { name: "type", label: "Type", type: "text", placeholder: "Gateway or payment type" },
      { name: "amount", label: "Amount", type: "number", placeholder: "0", required: true },
      { name: "reference", label: "Reference", type: "text", placeholder: "Transaction reference" },
      { name: "date", label: "Date", type: "date" },
      { name: "status", label: "Status", type: "select", options: ["Paid", "Pending", "Failed", "Cancelled"] },
    ],
  },
  quotes: {
    key: "quotes",
    eyebrow: "Billing",
    title: "Quotes",
    description: "Prepare client quotes for hosting, migration, domains, and custom services.",
    icon: FileText,
    listHref: "/admin/billing/quotes",
    createHref: "/admin/billing/quotes/new",
    createLabel: "New quote",
    searchPlaceholder: "Search quotes...",
    emptyTitle: "No quotes returned by API",
    emptyDescription: "Quotes from the backend will appear here.",
    fallback: noFallbackRecords,
    loader: emptyLoader,
    availability: "unconnected",
    editorFields: [
      { name: "client", label: "Client", type: "text", placeholder: "Client name", required: true },
      { name: "title", label: "Quote title", type: "text", placeholder: "Quote title", required: true },
      { name: "total", label: "Total", type: "number", placeholder: "0", required: true },
      { name: "description", label: "Description", type: "textarea", placeholder: "Quote details..." },
      { name: "status", label: "Status", type: "select", options: ["Draft", "Pending", "Accepted", "Rejected"] },
    ],
  },
  "billing-batch": {
    key: "billing-batch",
    eyebrow: "Billing",
    title: "Batch billing",
    description: "Prepare recurring invoices, renewal batches, reminders, and scheduled billing runs.",
    icon: FileStack,
    listHref: "/admin/billing/batch",
    searchPlaceholder: "Search billing batches...",
    emptyTitle: "No billing batches returned by API",
    emptyDescription: "Scheduled billing batches will appear here when the backend supports them.",
    fallback: noFallbackRecords,
    loader: emptyLoader,
    availability: "unconnected",
  },
  "print-queue": {
    key: "print-queue",
    eyebrow: "Billing",
    title: "Print queue",
    description: "Manage invoice PDFs, receipts, queued print jobs, and branded billing documents.",
    icon: Archive,
    listHref: "/admin/billing/print-queue",
    searchPlaceholder: "Search print queue...",
    emptyTitle: "No print jobs returned by API",
    emptyDescription: "Queued invoice and receipt PDFs will appear here when the backend supports them.",
    fallback: noFallbackRecords,
    loader: emptyLoader,
    availability: "unconnected",
  },
  "invoice-designer": {
    key: "invoice-designer",
    eyebrow: "Billing",
    title: "Invoice designer",
    description: "Design branded invoices, receipts, PDF layouts, and printable customer documents.",
    icon: Brush,
    listHref: "/admin/invoice-designer",
    searchPlaceholder: "Search invoice templates...",
    emptyTitle: "No invoice templates returned by API",
    emptyDescription: "Invoice templates will appear here when the backend supports them.",
    fallback: noFallbackRecords,
    loader: emptyLoader,
    availability: "unconnected",
  },
  staff: {
    key: "staff",
    eyebrow: "Staff",
    title: "Staff",
    description: "Manage support, billing, provisioning, and operational team members.",
    icon: UsersRound,
    listHref: "/admin/staff",
    createHref: "/admin/staff/new",
    createLabel: "Add staff",
    searchPlaceholder: "Search staff...",
    emptyTitle: "No staff returned by API",
    emptyDescription: "Staff records from the backend will appear here.",
    fallback: noFallbackRecords,
    loader: emptyLoader,
    availability: "unconnected",
    editorFields: [
      { name: "name", label: "Full name", type: "text", placeholder: "Full name", required: true },
      { name: "email", label: "Email", type: "text", placeholder: "staff@example.com", required: true },
      { name: "role", label: "Role", type: "select", options: ["staff", "admin"] },
      { name: "department", label: "Department", type: "text", placeholder: "Department" },
      { name: "status", label: "Status", type: "select", options: ["Active", "Inactive", "Suspended"] },
    ],
  },
  blacklist: {
    key: "blacklist",
    eyebrow: "Tools",
    title: "Blacklist",
    description: "Manage blocked emails, domains, IPs, abusive accounts, and fraud prevention rules.",
    icon: ShieldAlert,
    listHref: "/admin/tools/blacklist",
    searchPlaceholder: "Search blacklist rules...",
    emptyTitle: "No blacklist rules returned by API",
    emptyDescription: "Blacklist rules will appear here when the backend supports them.",
    fallback: noFallbackRecords,
    loader: emptyLoader,
    availability: "unconnected",
  },
  cms: {
    key: "cms",
    eyebrow: "Tools",
    title: "CMS",
    description: "Manage internal CMS areas, landing content, pages, and future customer-facing content.",
    icon: Settings2,
    listHref: "/admin/tools/cms",
    searchPlaceholder: "Search CMS records...",
    emptyTitle: "No CMS records returned by API",
    emptyDescription: "CMS records will appear here when the backend supports them.",
    fallback: noFallbackRecords,
    loader: emptyLoader,
    availability: "unconnected",
  },
  currency: {
    key: "currency",
    eyebrow: "Tools",
    title: "Currency",
    description: "Manage currencies, exchange rates, rounding rules, and multi-currency billing.",
    icon: Coins,
    listHref: "/admin/tools/currency",
    searchPlaceholder: "Search currencies...",
    emptyTitle: "No currency records returned by API",
    emptyDescription: "Currency records will appear here when the backend supports them.",
    fallback: noFallbackRecords,
    loader: emptyLoader,
    availability: "unconnected",
  },
  "download-manager": {
    key: "download-manager",
    eyebrow: "Tools",
    title: "Download manager",
    description: "Manage downloadable resources, templates, attachments, and client files.",
    icon: Download,
    listHref: "/admin/tools/download-manager",
    searchPlaceholder: "Search downloads...",
    emptyTitle: "No downloads returned by API",
    emptyDescription: "Download records will appear here when the backend supports them.",
    fallback: noFallbackRecords,
    loader: emptyLoader,
    availability: "unconnected",
  },
  "mass-mailer": {
    key: "mass-mailer",
    eyebrow: "Tools",
    title: "Mass mailer",
    description: "Send operational announcements, product updates, billing reminders, and client notices.",
    icon: Mail,
    listHref: "/admin/tools/mass-mailer",
    searchPlaceholder: "Search mail campaigns...",
    emptyTitle: "No campaigns returned by API",
    emptyDescription: "Mail campaigns will appear here when the backend supports them.",
    fallback: noFallbackRecords,
    loader: emptyLoader,
    availability: "unconnected",
  },
  "service-queue": {
    key: "service-queue",
    eyebrow: "Tools",
    title: "Service queue",
    description: "Monitor service automation actions, retries, failed jobs, and manual intervention items.",
    icon: ServerCog,
    listHref: "/admin/tools/service-queue",
    searchPlaceholder: "Search service queue...",
    emptyTitle: "No service queue items returned by API",
    emptyDescription: "Service queue records will appear here when the backend supports them.",
    fallback: noFallbackRecords,
    loader: emptyLoader,
    availability: "unconnected",
  },
};