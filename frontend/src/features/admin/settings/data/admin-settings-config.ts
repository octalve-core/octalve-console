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
    description: "Review platform identity, public URLs and default preferences; editing requires a verified configuration workflow.",
    href: "/admin/settings/general",
    icon: Building2,
    status: "Needs setup",
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
    description: "Review sender configuration and message templates; live sending requires a verified mail provider.",
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
    description: "Tax and invoice-compliance policy; editing and legal certification are not connected here.",
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
    description: "Review hosting suppliers, payment gateways, domain records and approved retail offers.",
    href: "/admin/settings/providers",
    icon: PlugZap,
    status: "Needs setup",
    fields: [
      { label: "Provider identity", value: "Inspect live records under Servers / Providers" },
      { label: "Provisioning", value: "Disabled pending audited worker and payment authority" },
      { label: "Registrar and SSL", value: "Not yet configured as live integrations" },
    ],
  },
  {
    key: "api-keys",
    title: "API keys",
    description: "Review API-access policy. Credential issuance and rotation are not connected here.",
    href: "/admin/settings/api-keys",
    icon: KeyRound,
    status: "Needs setup",
    fields: [
      { label: "Access", value: "Role-based" },
      { label: "Permissions", value: "Fine-grained" },
      { label: "IP limits", value: "Supported" },
    ],
  },
  {
    key: "notifications",
    title: "Notifications",
    description: "Review saved notification templates; external email delivery requires separate setup.",
    href: "/admin/settings/notifications",
    icon: Bell,
    status: "Needs setup",
    fields: [
      { label: "Invoice templates", value: "Ready" },
      { label: "Ticket templates", value: "Ready" },
      { label: "Auth templates", value: "Ready" },
    ],
  },
  {
    key: "credits",
    title: "Credits",
    description: "Wallet and credit policy. No new deposit or auto-apply authority is enabled here.",
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
    description: "Review billing schedules and renewal preflight; automatic execution is not enabled here.",
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
    description: "Review invoice records, PDF templates, queue readiness and billing policy.",
    href: "/admin/settings/invoices",
    icon: FileText,
    status: "Needs setup",
    fields: [
      { label: "Prefix", value: "INV" },
      { label: "PDF", value: "Template-ready" },
      { label: "Due policy", value: "Configurable" },
    ],
  },
  {
    key: "social-login",
    title: "Social login",
    description: "Future third-party sign-in options; no OAuth providers are enabled from this page.",
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
    description: "Review the Console appearance. Theme changes are not connected to a saved editor.",
    href: "/admin/settings/theme",
    icon: Palette,
    status: "Needs setup",
    fields: [
      { label: "Primary color", value: "#0064E0" },
      { label: "Background", value: "#F6F8FB" },
      { label: "Style", value: "Premium cloud" },
    ],
  },
  {
    key: "tickets",
    title: "Tickets",
    description: "Review support departments, ticket responses and routing; advanced automation is not connected.",
    href: "/admin/settings/tickets",
    icon: Ticket,
    status: "Needs setup",
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