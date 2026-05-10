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

const billingRecords: AdminWorkspaceRecord[] = [
  {
    id: "BIL-001",
    title: "Invoice operations",
    subtitle: "Create, track, print, and reconcile invoices",
    meta: "Billing center",
    status: "Ready",
    amount: "₦24,500",
    date: "Today",
    actionHref: "/admin/billing/invoices",
  },
  {
    id: "BIL-002",
    title: "Domain billing",
    subtitle: "Renewals, registrations, and expiry billing",
    meta: "Domains",
    status: "Ready",
    amount: "₦14,500",
    date: "Today",
    actionHref: "/admin/billing/domains",
  },
  {
    id: "BIL-003",
    title: "Service billing",
    subtitle: "Hosting, VPS, email, and cloud service charges",
    meta: "Services",
    status: "Ready",
    amount: "₦12,000",
    date: "Today",
    actionHref: "/admin/billing/services",
  },
];

const serviceRecords: AdminWorkspaceRecord[] = [
  {
    id: "SVC-001",
    title: "brandde.com",
    subtitle: "Web Hosting · Business Plan",
    meta: "DirectAdmin",
    status: "Active",
    amount: "₦3,500",
    date: "Renews Jun 30, 2026",
    actionHref: "/admin/billing/services/SVC-001",
  },
  {
    id: "SVC-002",
    title: "api.brandde.com",
    subtitle: "VPS Hosting · VPS-1",
    meta: "VPS Provider",
    status: "Pending",
    amount: "₦12,000",
    date: "Provisioning",
    actionHref: "/admin/billing/services/SVC-002",
  },
];

const transactionRecords: AdminWorkspaceRecord[] = [
  {
    id: "TRX-001",
    title: "Paystack payment",
    subtitle: "Brandde Studio · INV-001",
    meta: "Gateway transaction",
    status: "Paid",
    amount: "₦3,500",
    date: "Today",
    actionHref: "/admin/billing/transactions/TRX-001",
  },
  {
    id: "TRX-002",
    title: "Manual transfer",
    subtitle: "DataArena Labs · INV-002",
    meta: "Manual approval",
    status: "Pending",
    amount: "₦12,000",
    date: "Yesterday",
    actionHref: "/admin/billing/transactions/TRX-002",
  },
];

const quoteRecords: AdminWorkspaceRecord[] = [
  {
    id: "QTE-001",
    title: "Business hosting quote",
    subtitle: "Brandde Studio",
    meta: "Hosting quote",
    status: "Draft",
    amount: "₦42,000",
    date: "Today",
    actionHref: "/admin/billing/quotes/QTE-001",
  },
  {
    id: "QTE-002",
    title: "VPS migration quote",
    subtitle: "DataArena Labs",
    meta: "Migration quote",
    status: "Pending",
    amount: "₦85,000",
    date: "Today",
    actionHref: "/admin/billing/quotes/QTE-002",
  },
];

const staffRecords: AdminWorkspaceRecord[] = [
  {
    id: "STF-001",
    title: "Octalve Staff",
    subtitle: "staff@octalve.cloud",
    meta: "Support and provisioning",
    status: "Active",
    date: "Last login today",
    actionHref: "/admin/staff/STF-001",
  },
  {
    id: "STF-002",
    title: "Billing Officer",
    subtitle: "billing@octalve.cloud",
    meta: "Billing and invoices",
    status: "Active",
    date: "Last login yesterday",
    actionHref: "/admin/staff/STF-002",
  },
];

const toolRecords: AdminWorkspaceRecord[] = [
  {
    id: "TOOL-001",
    title: "Tool module",
    subtitle: "API-ready admin utility workspace",
    meta: "Internal tool",
    status: "Ready",
    date: "Configured",
    actionHref: "#",
  },
];

export const adminWorkspaceConfig: Record<AdminWorkspaceKey, AdminWorkspaceConfig> = {
  billing: {
    key: "billing",
    eyebrow: "Billing",
    title: "Billing center",
    description: "Control invoices, services, domains, transactions, quotes, print queue, and batch billing.",
    icon: ReceiptText,
    listHref: "/admin/billing",
    searchPlaceholder: "Search billing modules...",
    emptyTitle: "No billing modules found",
    emptyDescription: "Billing modules will appear here.",
    fallback: billingRecords,
    loader: emptyLoader,
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
    emptyTitle: "No services found",
    emptyDescription: "Billable services from the backend will appear here.",
    fallback: serviceRecords,
    loader: () => adminApi.services(),
    editorFields: [
      { name: "customer", label: "Customer", type: "text", placeholder: "Customer name or ID", required: true },
      { name: "label", label: "Service label", type: "text", placeholder: "brandde.com", required: true },
      { name: "product", label: "Product", type: "text", placeholder: "Web Hosting", required: true },
      { name: "package", label: "Package", type: "text", placeholder: "Business", required: true },
      { name: "term", label: "Term", type: "text", placeholder: "Monthly" },
      { name: "renews", label: "Renews", type: "date" },
      { name: "status", label: "Status", type: "select", options: ["Active", "Pending", "Suspended", "Cancelled"] },
    ],
  },
  transactions: {
    key: "transactions",
    eyebrow: "Billing",
    title: "Transactions",
    description: "Track Paystack, Flutterwave, wallet, transfer, and manual payment transactions.",
    icon: Banknote,
    listHref: "/admin/billing/transactions",
    createHref: "/admin/billing/transactions/new",
    createLabel: "Add transaction",
    searchPlaceholder: "Search transactions...",
    emptyTitle: "No transactions found",
    emptyDescription: "Transactions from the backend will appear here.",
    fallback: transactionRecords,
    loader: () => schemaApi.payments.transactions(),
    editorFields: [
      { name: "client", label: "Client", type: "text", placeholder: "Client name", required: true },
      { name: "type", label: "Type", type: "text", placeholder: "Paystack" },
      { name: "amount", label: "Amount", type: "number", placeholder: "3500", required: true },
      { name: "reference", label: "Reference", type: "text", placeholder: "trx_xxx" },
      { name: "date", label: "Date", type: "date" },
      { name: "status", label: "Status", type: "select", options: ["Paid", "Pending", "Failed", "Cancelled"] },
    ],
  },
  quotes: {
    key: "quotes",
    eyebrow: "Billing",
    title: "Quotes",
    description: "Prepare client quotes for hosting, VPS, migration, domains, and custom services.",
    icon: FileText,
    listHref: "/admin/billing/quotes",
    createHref: "/admin/billing/quotes/new",
    createLabel: "New quote",
    searchPlaceholder: "Search quotes...",
    emptyTitle: "No quotes found",
    emptyDescription: "Quotes from the backend will appear here.",
    fallback: quoteRecords,
    loader: emptyLoader,
    editorFields: [
      { name: "client", label: "Client", type: "text", placeholder: "Client name", required: true },
      { name: "title", label: "Quote title", type: "text", placeholder: "Business hosting quote", required: true },
      { name: "total", label: "Total", type: "number", placeholder: "42000", required: true },
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
    emptyTitle: "No billing batches found",
    emptyDescription: "Scheduled billing batches will appear here.",
    fallback: [
      {
        id: "BAT-001",
        title: "Monthly hosting renewals",
        subtitle: "Generate invoices for monthly hosting services",
        meta: "Scheduled billing",
        status: "Ready",
        date: "Month end",
        actionHref: "/admin/billing/batch",
      },
    ],
    loader: emptyLoader,
  },
  "print-queue": {
    key: "print-queue",
    eyebrow: "Billing",
    title: "Print queue",
    description: "Manage invoice PDFs, receipts, queued print jobs, and branded billing documents.",
    icon: Archive,
    listHref: "/admin/billing/print-queue",
    searchPlaceholder: "Search print queue...",
    emptyTitle: "No print jobs found",
    emptyDescription: "Queued invoice and receipt PDFs will appear here.",
    fallback: [
      {
        id: "PRN-001",
        title: "INV-001 PDF",
        subtitle: "Brandde Studio invoice",
        meta: "Invoice PDF",
        status: "Ready",
        date: "Today",
        actionHref: "/admin/billing/print-queue",
      },
    ],
    loader: emptyLoader,
  },
  "invoice-designer": {
    key: "invoice-designer",
    eyebrow: "Billing",
    title: "Invoice designer",
    description: "Design branded invoices, receipts, PDF layouts, and printable customer documents.",
    icon: Brush,
    listHref: "/admin/invoice-designer",
    searchPlaceholder: "Search invoice templates...",
    emptyTitle: "No templates found",
    emptyDescription: "Invoice templates will appear here.",
    fallback: [
      {
        id: "TPL-001",
        title: "Default invoice template",
        subtitle: "Octalve branded invoice design",
        meta: "PDF template",
        status: "Ready",
        date: "Active",
        actionHref: "/admin/invoice-designer",
      },
    ],
    loader: emptyLoader,
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
    emptyTitle: "No staff found",
    emptyDescription: "Staff records from the backend will appear here.",
    fallback: staffRecords,
    loader: emptyLoader,
    editorFields: [
      { name: "name", label: "Full name", type: "text", placeholder: "Octalve Staff", required: true },
      { name: "email", label: "Email", type: "text", placeholder: "staff@octalve.cloud", required: true },
      { name: "role", label: "Role", type: "select", options: ["staff", "admin"] },
      { name: "department", label: "Department", type: "text", placeholder: "Support" },
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
    emptyTitle: "No blacklist rules found",
    emptyDescription: "Blacklist rules will appear here.",
    fallback: toolRecords,
    loader: emptyLoader,
  },
  cms: {
    key: "cms",
    eyebrow: "Tools",
    title: "CMS",
    description: "Manage internal CMS areas, landing content, pages, and future customer-facing content.",
    icon: Settings2,
    listHref: "/admin/tools/cms",
    searchPlaceholder: "Search CMS records...",
    emptyTitle: "No CMS records found",
    emptyDescription: "CMS records will appear here.",
    fallback: toolRecords,
    loader: emptyLoader,
  },
  currency: {
    key: "currency",
    eyebrow: "Tools",
    title: "Currency",
    description: "Manage currencies, exchange rates, rounding rules, and multi-currency billing.",
    icon: Coins,
    listHref: "/admin/tools/currency",
    searchPlaceholder: "Search currencies...",
    emptyTitle: "No currency records found",
    emptyDescription: "Currency records will appear here.",
    fallback: [
      {
        id: "CUR-001",
        title: "Nigerian Naira",
        subtitle: "NGN",
        meta: "Default currency",
        status: "Active",
        date: "Default",
        actionHref: "/admin/tools/currency",
      },
    ],
    loader: emptyLoader,
  },
  "download-manager": {
    key: "download-manager",
    eyebrow: "Tools",
    title: "Download manager",
    description: "Manage downloadable resources, templates, attachments, and client files.",
    icon: Download,
    listHref: "/admin/tools/download-manager",
    searchPlaceholder: "Search downloads...",
    emptyTitle: "No downloads found",
    emptyDescription: "Download records will appear here.",
    fallback: toolRecords,
    loader: emptyLoader,
  },
  "mass-mailer": {
    key: "mass-mailer",
    eyebrow: "Tools",
    title: "Mass mailer",
    description: "Send operational announcements, product updates, billing reminders, and client notices.",
    icon: Mail,
    listHref: "/admin/tools/mass-mailer",
    searchPlaceholder: "Search mail campaigns...",
    emptyTitle: "No campaigns found",
    emptyDescription: "Mail campaigns will appear here.",
    fallback: toolRecords,
    loader: emptyLoader,
  },
  "service-queue": {
    key: "service-queue",
    eyebrow: "Tools",
    title: "Service queue",
    description: "Monitor service automation actions, retries, failed jobs, and manual intervention items.",
    icon: ServerCog,
    listHref: "/admin/tools/service-queue",
    searchPlaceholder: "Search service queue...",
    emptyTitle: "No service queue items found",
    emptyDescription: "Service queue records will appear here.",
    fallback: toolRecords,
    loader: emptyLoader,
  },
};