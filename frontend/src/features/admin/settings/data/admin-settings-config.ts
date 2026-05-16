import {
  Bell,
  Building2,
  Clock3,
  CreditCard,
  FileText,
  KeyRound,
  Mail,
  Palette,
  Percent,
  PlugZap,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminSettingsKey =
  | "general"
  | "security"
  | "mail"
  | "tax"
  | "providers"
  | "api-keys"
  | "notifications"
  | "credits"
  | "cron-jobs"
  | "invoices"
  | "social-login"
  | "theme"
  | "tickets"
  | "other";

export type AdminSettingsItem = {
  key: AdminSettingsKey;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  status: "Ready" | "Needs setup" | "Connected" | "Draft";
  fields: Array<{
    label: string;
    value: string;
  }>;
};

export const adminSettingsItems: AdminSettingsItem[] = [
  {
    key: "general",
    title: "General",
    description: "App name, URL, timezone, default language, and platform identity.",
    href: "/admin/settings/general",
    icon: Building2,
    status: "Ready",
    fields: [
      { label: "App URL", value: "https://console.octalve.cloud" },
      { label: "Timezone", value: "Africa/Lagos" },
      { label: "Default language", value: "English" },
    ],
  },
  {
    key: "security",
    title: "Security",
    description: "CAPTCHA, trusted proxies, session protection, and secure access rules.",
    href: "/admin/settings/security",
    icon: ShieldCheck,
    status: "Needs setup",
    fields: [
      { label: "Captcha", value: "Planned" },
      { label: "Trusted proxies", value: "Not configured" },
      { label: "Session policy", value: "JWT authentication" },
    ],
  },
  {
    key: "mail",
    title: "Mail",
    description: "SMTP, sender email, templates, and delivery configuration.",
    href: "/admin/settings/mail",
    icon: Mail,
    status: "Needs setup",
    fields: [
      { label: "Driver", value: "SMTP" },
      { label: "From email", value: "support@octalve.cloud" },
      { label: "Templates", value: "HTML-ready" },
    ],
  },
  {
    key: "tax",
    title: "Tax",
    description: "Tax mode, inclusive/exclusive pricing, invoices, and compliance setup.",
    href: "/admin/settings/tax",
    icon: Percent,
    status: "Draft",
    fields: [
      { label: "Tax enabled", value: "No" },
      { label: "Mode", value: "Exclusive" },
      { label: "Region", value: "Nigeria" },
    ],
  },
  {
    key: "providers",
    title: "Providers",
    description: "DirectAdmin, cPanel, VPS, registrar, and automation providers.",
    href: "/admin/settings/providers",
    icon: PlugZap,
    status: "Connected",
    fields: [
      { label: "Primary panel", value: "DirectAdmin" },
      { label: "Provisioning", value: "API-ready" },
      { label: "Registrar", value: "Planned" },
    ],
  },
  {
    key: "api-keys",
    title: "API keys",
    description: "Create keys for users, invoices, tickets, orders, services, and integrations.",
    href: "/admin/settings/api-keys",
    icon: KeyRound,
    status: "Ready",
    fields: [
      { label: "Access", value: "Role-based" },
      { label: "Permissions", value: "Fine-grained" },
      { label: "IP limits", value: "Supported" },
    ],
  },
  {
    key: "notifications",
    title: "Notifications",
    description: "New login, invoice, order, service, ticket, and verification templates.",
    href: "/admin/settings/notifications",
    icon: Bell,
    status: "Ready",
    fields: [
      { label: "Invoice templates", value: "Ready" },
      { label: "Ticket templates", value: "Ready" },
      { label: "Auth templates", value: "Ready" },
    ],
  },
  {
    key: "credits",
    title: "Credits",
    description: "Wallet deposits, credit limits, auto-apply rules, and recurring balances.",
    href: "/admin/settings/credits",
    icon: CreditCard,
    status: "Draft",
    fields: [
      { label: "Minimum deposit", value: "₦0" },
      { label: "Maximum deposit", value: "Not set" },
      { label: "Auto-apply", value: "Planned" },
    ],
  },
  {
    key: "cron-jobs",
    title: "Cron jobs",
    description: "Invoice reminders, renewals, suspensions, and data retention jobs.",
    href: "/admin/settings/cron-jobs",
    icon: Clock3,
    status: "Needs setup",
    fields: [
      { label: "Invoice reminders", value: "Planned" },
      { label: "Suspension window", value: "Planned" },
      { label: "Retention", value: "Planned" },
    ],
  },
  {
    key: "invoices",
    title: "Invoices",
    description: "Invoice numbering, print queue, due dates, payment rules, and PDF branding.",
    href: "/admin/settings/invoices",
    icon: FileText,
    status: "Ready",
    fields: [
      { label: "Prefix", value: "INV" },
      { label: "PDF", value: "Template-ready" },
      { label: "Due policy", value: "Configurable" },
    ],
  },
  {
    key: "social-login",
    title: "Social login",
    description: "Google, GitHub, Discord, and future account login integrations.",
    href: "/admin/settings/social-login",
    icon: Users,
    status: "Draft",
    fields: [
      { label: "Google", value: "Planned" },
      { label: "GitHub", value: "Planned" },
      { label: "Discord", value: "Planned" },
    ],
  },
  {
    key: "theme",
    title: "Theme",
    description: "Brand color, logo, admin style, client portal appearance, and UI preference.",
    href: "/admin/settings/theme",
    icon: Palette,
    status: "Ready",
    fields: [
      { label: "Primary color", value: "#0064E0" },
      { label: "Background", value: "#F6F8FB" },
      { label: "Style", value: "Premium cloud" },
    ],
  },
  {
    key: "tickets",
    title: "Tickets",
    description: "Departments, piping, escalation, ticket priorities, and support routing.",
    href: "/admin/settings/tickets",
    icon: Ticket,
    status: "Ready",
    fields: [
      { label: "Departments", value: "Supported" },
      { label: "Escalation", value: "Planned" },
      { label: "Responses", value: "Supported" },
    ],
  },
  {
    key: "other",
    title: "Other",
    description: "Advanced settings, experimental features, and internal operational controls.",
    href: "/admin/settings/other",
    icon: Settings,
    status: "Draft",
    fields: [
      { label: "Advanced", value: "Available" },
      { label: "Experimental", value: "Controlled" },
      { label: "Internal flags", value: "Planned" },
    ],
  },
];

export function getAdminSettingsItem(key: AdminSettingsKey) {
  return adminSettingsItems.find((item) => item.key === key) ?? adminSettingsItems[0];
}