import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField, type FormFieldProps } from "@/components/ui/FormField";

export type SettingsSectionKey =
  | "general"
  | "security"
  | "social-login"
  | "tax"
  | "mail"
  | "tickets"
  | "cron-jobs"
  | "credits"
  | "theme"
  | "invoices"
  | "other";

type SettingsSectionConfig = {
  label: string;
  title: string;
  description: string;
  fields: FormFieldProps[];
  notes: string[];
};

export const settingLinks: Array<{ key: SettingsSectionKey; label: string; href: string }> = [
  { key: "general", label: "General", href: "/admin/settings/general" },
  { key: "security", label: "Security", href: "/admin/settings/security" },
  { key: "social-login", label: "Social Login", href: "/admin/settings/social-login" },
  { key: "tax", label: "Tax", href: "/admin/settings/tax" },
  { key: "mail", label: "Mail", href: "/admin/settings/mail" },
  { key: "tickets", label: "Tickets", href: "/admin/settings/tickets" },
  { key: "cron-jobs", label: "Cron Jobs", href: "/admin/settings/cron-jobs" },
  { key: "credits", label: "Credits", href: "/admin/settings/credits" },
  { key: "theme", label: "Theme", href: "/admin/settings/theme" },
  { key: "invoices", label: "Invoices", href: "/admin/settings/invoices" },
  { key: "other", label: "Other", href: "/admin/settings/other" }
];

const sections: Record<SettingsSectionKey, SettingsSectionConfig> = {
  general: {
    label: "General",
    title: "General Settings",
    description: "Manage the company identity, application URL, timezone, language, official email and public policy links.",
    fields: [
      { label: "Company Name", value: "Octalve Cloud" },
      { label: "App URL", value: "https://console.octalve.cloud" },
      { label: "Timezone", value: "Africa/Lagos" },
      { label: "Default Language", value: "en" },
      { label: "System Email Address", value: "hello@octalve.cloud" },
      { label: "Terms of Service URL", value: "https://octalve.cloud/terms" },
      { label: "Logo Light Mode", type: "file" },
      { label: "Logo Dark Mode", type: "file" },
      { label: "Favicon", type: "file" }
    ],
    notes: [
      "Used across invoices, emails, client portal branding and admin identity.",
      "Backend should expose this group through GET/PATCH /api/v1/admin/settings/general/."
    ]
  },

  security: {
    label: "Security",
    title: "Security Settings",
    description: "Configure protection for admin access, customer login, captcha, trusted proxies and session behavior.",
    fields: [
      { label: "Captcha Provider", as: "select", options: ["Disabled", "Cloudflare Turnstile", "Google reCAPTCHA"], value: "Disabled" },
      { label: "Captcha Site Key", placeholder: "0x4AAAA..." },
      { label: "Captcha Secret", placeholder: "secret key", type: "password" },
      { label: "Trusted Proxies", as: "textarea", placeholder: "IP addresses or CIDR ranges" },
      { label: "Admin Session Timeout", value: "60 minutes" },
      { label: "Require Strong Passwords", as: "select", options: ["Enabled", "Disabled"], value: "Enabled" }
    ],
    notes: [
      "Frontend guards protect pages, but backend permissions must still protect all admin APIs.",
      "Secrets should be encrypted at rest in Django."
    ]
  },

  "social-login": {
    label: "Social Login",
    title: "Social Login Settings",
    description: "Prepare OAuth login options for clients, staff and admins.",
    fields: [
      { label: "Google Enabled", as: "select", options: ["Disabled", "Enabled"], value: "Disabled" },
      { label: "Google Client ID", placeholder: "client id" },
      { label: "Google Client Secret", placeholder: "client secret", type: "password" },
      { label: "GitHub Enabled", as: "select", options: ["Disabled", "Enabled"], value: "Disabled" },
      { label: "GitHub Client ID", placeholder: "client id" },
      { label: "GitHub Client Secret", placeholder: "client secret", type: "password" },
      { label: "Discord Enabled", as: "select", options: ["Disabled", "Enabled"], value: "Disabled" },
      { label: "Discord Client ID", placeholder: "client id" },
      { label: "Discord Client Secret", placeholder: "client secret", type: "password" }
    ],
    notes: [
      "This is future-ready. Email/password login remains the MVP priority.",
      "Backend should validate callback URLs and allowed providers."
    ]
  },

  tax: {
    label: "Tax",
    title: "Tax Settings",
    description: "Configure VAT/tax rules for invoices, receipts, product pricing and customer billing.",
    fields: [
      { label: "Tax Enabled", as: "select", options: ["Disabled", "Enabled"], value: "Disabled" },
      { label: "Tax Name", placeholder: "VAT" },
      { label: "Tax Rate", placeholder: "7.5%" },
      { label: "Tax Type", as: "select", options: ["Exclusive", "Inclusive"], value: "Exclusive" },
      { label: "Company Tax ID", placeholder: "Optional" },
      { label: "Show Tax Breakdown on Invoice", as: "select", options: ["Enabled", "Disabled"], value: "Enabled" }
    ],
    notes: [
      "Can stay disabled during MVP but should exist for proper invoice compliance later.",
      "Tax calculations must happen in backend billing logic, not only on frontend."
    ]
  },

  mail: {
    label: "Mail",
    title: "Mail Settings",
    description: "Configure SMTP and email structure for verification, password reset, invoices, tickets and service events.",
    fields: [
      { label: "Disable Mail", as: "select", options: ["No", "Yes"], value: "No" },
      { label: "Users Must Verify Email Before Buying", as: "select", options: ["No", "Yes"], value: "No" },
      { label: "Mail Host", placeholder: "smtp.example.com" },
      { label: "Mail Port", placeholder: "587" },
      { label: "Mail Username", placeholder: "smtp username" },
      { label: "Mail Password", type: "password", placeholder: "smtp password" },
      { label: "Mail Encryption", as: "select", options: ["TLS", "SSL", "None"], value: "TLS" },
      { label: "Mail From Address", value: "hello@octalve.cloud" },
      { label: "Mail From Name", value: "Octalve Cloud" },
      { label: "Email Header HTML", as: "textarea", placeholder: "<html>..." },
      { label: "Email Footer HTML", as: "textarea", placeholder: "© Octalve Cloud" },
      { label: "Mail CSS", as: "textarea", placeholder: "body { font-family: ... }" }
    ],
    notes: [
      "Mail settings power notification templates.",
      "SMTP passwords must be encrypted by the backend."
    ]
  },

  tickets: {
    label: "Tickets",
    title: "Ticket Settings",
    description: "Configure departments, email piping and support automation rules.",
    fields: [
      { label: "Default Ticket Department", as: "select", options: ["Support", "Billing", "Migration", "Technical"], value: "Support" },
      { label: "Disallow Clients from Closing Tickets", as: "select", options: ["No", "Yes"], value: "No" },
      { label: "Email Piping Enabled", as: "select", options: ["Disabled", "Enabled"], value: "Disabled" },
      { label: "Email Host", placeholder: "imap.example.com" },
      { label: "Email Port", placeholder: "993" },
      { label: "Email Address", placeholder: "support@octalve.cloud" },
      { label: "Email Password", type: "password", placeholder: "mailbox password" },
      { label: "Close Tickets After No Response", value: "7 days" }
    ],
    notes: [
      "Support departments should connect to ticket routing.",
      "Email piping can be implemented after the support MVP is stable."
    ]
  },

  "cron-jobs": {
    label: "Cron Jobs",
    title: "Cron Job Settings",
    description: "Control automated billing, reminders, suspension, termination, cleanup and ticket closing rules.",
    fields: [
      { label: "Daily Cron Time", value: "00:00" },
      { label: "Send Invoice If Due Date Is X Days Away", value: "7" },
      { label: "Send Invoice Reminder If Due Date Is X Days Away", value: "3" },
      { label: "Cancel Pending Order After X Days", value: "7" },
      { label: "Suspend Server If Invoice Is X Days Overdue", value: "2" },
      { label: "Delete Server If Invoice Is X Days Overdue", value: "14" },
      { label: "Delete Email Logs Older Than X Days", value: "90" },
      { label: "Close Tickets If No Response For X Days", value: "7" }
    ],
    notes: [
      "This is core for hosting automation.",
      "Backend should run this through Celery Beat, Redis and queued workers."
    ]
  },

  credits: {
    label: "Credits",
    title: "Credits & Wallet Settings",
    description: "Configure wallet deposits, credit limits, automatic invoice payment and downgrade credits.",
    fields: [
      { label: "Credits Enabled", as: "select", options: ["Enabled", "Disabled"], value: "Enabled" },
      { label: "Minimum Deposit", value: "500" },
      { label: "Maximum Deposit", value: "500000" },
      { label: "Maximum Credit Balance", value: "1000000" },
      { label: "Automatically Use Credits", as: "select", options: ["Enabled", "Disabled"], value: "Enabled" },
      { label: "Enable Credits on Service Downgrade", as: "select", options: ["Enabled", "Disabled"], value: "Disabled" }
    ],
    notes: [
      "Wallet balance should be ledger-based, not manually overwritten.",
      "Every credit/debit must create a transaction record."
    ]
  },

  theme: {
    label: "Theme",
    title: "Theme Settings",
    description: "Manage Octalve Console branding, colors, checkout behavior and public interface display.",
    fields: [
      { label: "Theme", as: "select", options: ["default", "octalve-premium"], value: "octalve-premium" },
      { label: "Logo Display", as: "select", options: ["Logo and Name", "Logo Only", "Name Only"], value: "Logo and Name" },
      { label: "Direct Checkout", as: "select", options: ["Disabled", "Enabled"], value: "Disabled" },
      { label: "Small Product Images", as: "select", options: ["Disabled", "Enabled"], value: "Disabled" },
      { label: "Show Category Description", as: "select", options: ["Enabled", "Disabled"], value: "Enabled" },
      { label: "Primary Brand Color", value: "#0064E0" },
      { label: "Secondary Brand Color", value: "#E61525" },
      { label: "Background Color", value: "#F4F7FB" },
      { label: "Home Page Text", as: "textarea", value: "Welcome to Octalve Cloud." }
    ],
    notes: [
      "Useful for premium brand control.",
      "Not as urgent as billing, gateways, adapters and auth."
    ]
  },

  invoices: {
    label: "Invoices",
    title: "Invoice Settings",
    description: "Configure official invoice identity, numbering, proforma behavior and invoice snapshots.",
    fields: [
      { label: "Bill To Text", as: "textarea", value: "Octalve Cloud\nAbuja, Nigeria" },
      { label: "Next Invoice Number", value: "1" },
      { label: "Invoice Number Padding", value: "4" },
      { label: "Invoice Number Format", value: "INV-{year}-{number}" },
      { label: "Proforma Invoices", as: "select", options: ["Disabled", "Enabled"], value: "Enabled" },
      { label: "Invoice Snapshot", as: "select", options: ["Enabled", "Disabled"], value: "Enabled" },
      { label: "Invoice Footer Note", as: "textarea", value: "Thank you for choosing Octalve Cloud." }
    ],
    notes: [
      "Invoice snapshots keep old invoices stable even if client profile changes later.",
      "Backend must control numbering to avoid duplicate invoice numbers."
    ]
  },

  other: {
    label: "Other",
    title: "Other System Settings",
    description: "Manage default currency, registration, ticket access, pagination, debug mode and maintenance behavior.",
    fields: [
      { label: "Default Currency", as: "select", options: ["NGN", "USD", "GBP"], value: "NGN" },
      { label: "Disable User Registration", as: "select", options: ["No", "Yes"], value: "No" },
      { label: "Disable Tickets", as: "select", options: ["No", "Yes"], value: "No" },
      { label: "Pagination", value: "10" },
      { label: "Debug Mode", as: "select", options: ["Disabled", "Enabled"], value: "Disabled" },
      { label: "Maintenance Mode", as: "select", options: ["Disabled", "Enabled"], value: "Disabled" },
      { label: "Default Avatar", as: "select", options: ["Initials", "Gravatar", "Wavatar"], value: "Initials" }
    ],
    notes: [
      "This page should only contain miscellaneous settings.",
      "Critical features should have dedicated settings pages."
    ]
  }
};

export function SettingsSectionPage({ section }: { section: SettingsSectionKey }) {
  const config = sections[section];

  return (
    <main className="page-container">
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <>
            <Button href="/admin/settings/providers" variant="secondary">Providers</Button>
            <Button href="/admin/settings/api-keys" variant="secondary">API Keys</Button>
            <Button href="/admin/settings/notifications" variant="secondary">Notifications</Button>
            <Button>Save Settings</Button>
          </>
        }
      />

      <div className="tabs">
        {settingLinks.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={item.key === section ? "tab active" : "tab"}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <Card padded>
        <div className="section-heading">
          <div>
            <p className="eyebrow">System Configuration</p>
            <h2>{config.label}</h2>
            <p>These fields are ready for the Django settings registry API.</p>
          </div>
        </div>

        <div className="form-grid">
          {config.fields.map((field) => (
            <FormField
              key={`${section}-${field.label}`}
              {...field}
            />
          ))}
        </div>

        <div className="page-actions" style={{ marginTop: 20 }}>
          <Button>Save {config.label}</Button>
        </div>
      </Card>

      <Card padded>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Implementation Notes</p>
            <h2>Backend guidance</h2>
          </div>
        </div>

        <ul className="settings-note-list">
          {config.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
