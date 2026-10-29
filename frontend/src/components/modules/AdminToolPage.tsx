import {
  Activity,
  Ban,
  Database,
  Download,
  FileText,
  Mail,
  RefreshCw,
  ShieldAlert,
  Wrench
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { DataTable } from "@/components/ui/DataTable";

type ToolKey =
  | "service-queue"
  | "blacklist"
  | "download-manager"
  | "cms"
  | "currency"
  | "mass-mailer"
  | "utilities";

type ToolConfig = {
  title: string;
  description: string;
  icon: typeof Activity;
  backend: string[];
  stats: Array<{ label: string; value: string; detail: string }>;
  rows: Array<Record<string, string>>;
  columns: Array<{ header: string; accessor: string }>;
  fields: Array<{
    label: string;
    placeholder?: string;
    value?: string;
    type?: string;
    as?: "input" | "select" | "textarea";
    options?: string[];
  }>;
};

const toolConfigs: Record<ToolKey, ToolConfig> = {
  "service-queue": {
    title: "Service Queue",
    description:
      "Monitor provisioning, renewal, suspension, unsuspension, cancellation and service-change automation queues.",
    icon: Activity,
    backend: [
      "GET /api/v1/admin/tools/service-queue/",
      "POST /api/v1/admin/tools/service-queue/{id}/run/",
      "POST /api/v1/admin/tools/service-queue/{id}/retry/",
      "POST /api/v1/admin/tools/service-queue/{id}/cancel/"
    ],
    stats: [
      { label: "Pending", value: "8", detail: "Waiting for worker" },
      { label: "Retryable", value: "3", detail: "Provider/network errors" },
      { label: "Failed", value: "1", detail: "Needs admin review" }
    ],
    columns: [
      { header: "Task", accessor: "task" },
      { header: "Service", accessor: "service" },
      { header: "Adapter", accessor: "adapter" },
      { header: "Status", accessor: "status" },
      { header: "Next Run", accessor: "nextRun" }
    ],
    rows: [
      {
        task: "Provision hosting account",
        service: "SERVICE-ID",
        adapter: "DirectAdminAdapter",
        status: "Queued",
        nextRun: "Now"
      },
      {
        task: "Suspend overdue VPS",
        service: "SVC-VPS-001",
        adapter: "ProxmoxAdapter",
        status: "Pending",
        nextRun: "Today 23:00"
      },
      {
        task: "Renew domain",
        service: "DOM-001",
        adapter: "DomainRegistrarAdapter",
        status: "Retryable",
        nextRun: "In 15 mins"
      }
    ],
    fields: [
      { label: "Queue Type", as: "select", options: ["Provision", "Renewal", "Suspension", "Unsuspension", "Termination", "Service Change"], value: "Provision" },
      { label: "Service ID", placeholder: "SERVICE-ID" },
      { label: "Adapter", as: "select", options: ["DirectAdminAdapter", "ProxmoxAdapter", "DomainRegistrarAdapter", "CloudflareAdapter"], value: "DirectAdminAdapter" },
      { label: "Priority", as: "select", options: ["Low", "Normal", "High", "Urgent"], value: "Normal" },
      { label: "Operational Notes", as: "textarea", placeholder: "Describe the queue operation or retry reason" }
    ]
  },

  blacklist: {
    title: "Blacklist",
    description:
      "Block suspicious IP addresses, email domains, client accounts, hostnames and CIDR ranges.",
    icon: Ban,
    backend: [
      "GET /api/v1/admin/tools/blacklist/",
      "POST /api/v1/admin/tools/blacklist/",
      "PATCH /api/v1/admin/tools/blacklist/{id}/",
      "DELETE /api/v1/admin/tools/blacklist/{id}/"
    ],
    stats: [
      { label: "Active rules", value: "12", detail: "Currently enforced" },
      { label: "IP blocks", value: "7", detail: "IP/CIDR rules" },
      { label: "Email rules", value: "5", detail: "Domain/email filters" }
    ],
    columns: [
      { header: "Rule", accessor: "rule" },
      { header: "Type", accessor: "type" },
      { header: "Reason", accessor: "reason" },
      { header: "Status", accessor: "status" }
    ],
    rows: [
      { rule: "192.168.10.0/24", type: "CIDR", reason: "Abuse attempts", status: "Active" },
      { rule: "fraudmail.test", type: "Email Domain", reason: "Fraud signup pattern", status: "Active" },
      { rule: "suspicious-client@example.com", type: "Email", reason: "Chargeback history", status: "Review" }
    ],
    fields: [
      { label: "Rule Type", as: "select", options: ["IP", "CIDR", "Email", "Email Domain", "Client ID", "Hostname"], value: "IP" },
      { label: "Rule Value", placeholder: "192.168.1.10 or bad-domain.com" },
      { label: "Reason", placeholder: "Fraud, abuse, spam, chargeback, attack pattern" },
      { label: "Status", as: "select", options: ["Active", "Inactive", "Review"], value: "Active" },
      { label: "Internal Notes", as: "textarea", placeholder: "Private admin note about this blacklist rule" }
    ]
  },

  "download-manager": {
    title: "Download Manager",
    description:
      "Manage protected downloads, files, public assets, client-only files and signed download access.",
    icon: Download,
    backend: [
      "GET /api/v1/admin/tools/downloads/",
      "POST /api/v1/admin/tools/downloads/",
      "PATCH /api/v1/admin/tools/downloads/{id}/",
      "POST /api/v1/admin/tools/downloads/{id}/generate-signed-url/"
    ],
    stats: [
      { label: "Files", value: "9", detail: "Managed downloads" },
      { label: "Protected", value: "6", detail: "Requires client access" },
      { label: "Public", value: "3", detail: "Open access" }
    ],
    columns: [
      { header: "File", accessor: "file" },
      { header: "Visibility", accessor: "visibility" },
      { header: "Downloads", accessor: "downloads" },
      { header: "Status", accessor: "status" }
    ],
    rows: [
      { file: "hosting-welcome-guide.pdf", visibility: "Client", downloads: "42", status: "Active" },
      { file: "migration-checklist.pdf", visibility: "Public", downloads: "18", status: "Active" },
      { file: "server-onboarding.zip", visibility: "Staff", downloads: "7", status: "Restricted" }
    ],
    fields: [
      { label: "File Name", placeholder: "hosting-welcome-guide.pdf" },
      { label: "Visibility", as: "select", options: ["Public", "Client", "Staff", "Admin Only"], value: "Client" },
      { label: "Category", placeholder: "Hosting, Migration, Billing, Security" },
      { label: "File Upload", type: "file" },
      { label: "Description", as: "textarea", placeholder: "Describe what this file is used for" }
    ]
  },

  cms: {
    title: "CMS Pages",
    description:
      "Create and manage client portal pages such as terms, privacy, onboarding, migration and service policies.",
    icon: FileText,
    backend: [
      "GET /api/v1/admin/tools/cms-pages/",
      "POST /api/v1/admin/tools/cms-pages/",
      "PATCH /api/v1/admin/tools/cms-pages/{id}/",
      "DELETE /api/v1/admin/tools/cms-pages/{id}/"
    ],
    stats: [
      { label: "Published", value: "5", detail: "Visible pages" },
      { label: "Drafts", value: "2", detail: "Not published" },
      { label: "Policy pages", value: "3", detail: "Legal/support" }
    ],
    columns: [
      { header: "Page", accessor: "page" },
      { header: "Slug", accessor: "slug" },
      { header: "Visibility", accessor: "visibility" },
      { header: "Status", accessor: "status" }
    ],
    rows: [
      { page: "Terms of Service", slug: "/terms", visibility: "Public", status: "Published" },
      { page: "Migration Policy", slug: "/migration-policy", visibility: "Client", status: "Published" },
      { page: "Acceptable Use Policy", slug: "/acceptable-use", visibility: "Public", status: "Draft" }
    ],
    fields: [
      { label: "Page Title", placeholder: "Terms of Service" },
      { label: "Slug", placeholder: "/terms" },
      { label: "Visibility", as: "select", options: ["Public", "Client", "Staff", "Admin Only"], value: "Public" },
      { label: "Status", as: "select", options: ["Draft", "Published", "Archived"], value: "Draft" },
      { label: "Page Content", as: "textarea", placeholder: "Write page content here" }
    ]
  },

  currency: {
    title: "Currency Converter",
    description:
      "Manage exchange rates, base currency, supported currencies and future rate-provider automation.",
    icon: RefreshCw,
    backend: [
      "GET /api/v1/admin/tools/currencies/",
      "POST /api/v1/admin/tools/currencies/",
      "PATCH /api/v1/admin/tools/currencies/{code}/",
      "POST /api/v1/admin/tools/currencies/sync-rates/"
    ],
    stats: [
      { label: "Base", value: "NGN", detail: "Primary currency" },
      { label: "Currencies", value: "3", detail: "Enabled" },
      { label: "Auto sync", value: "Off", detail: "Manual rates now" }
    ],
    columns: [
      { header: "Currency", accessor: "currency" },
      { header: "Code", accessor: "code" },
      { header: "Rate", accessor: "rate" },
      { header: "Status", accessor: "status" }
    ],
    rows: [
      { currency: "Nigerian Naira", code: "NGN", rate: "1.00", status: "Base" },
      { currency: "US Dollar", code: "USD", rate: "1500.00", status: "Enabled" },
      { currency: "British Pound", code: "GBP", rate: "1900.00", status: "Enabled" }
    ],
    fields: [
      { label: "Currency Name", placeholder: "US Dollar" },
      { label: "Currency Code", placeholder: "USD" },
      { label: "Exchange Rate", placeholder: "1500" },
      { label: "Symbol", placeholder: "$" },
      { label: "Status", as: "select", options: ["Enabled", "Disabled"], value: "Enabled" }
    ]
  },

  "mass-mailer": {
    title: "Mass Mailer",
    description:
      "Send targeted emails to clients by service type, invoice status, language, plan, country or customer group.",
    icon: Mail,
    backend: [
      "GET /api/v1/admin/tools/mass-mailer/campaigns/",
      "POST /api/v1/admin/tools/mass-mailer/campaigns/",
      "POST /api/v1/admin/tools/mass-mailer/campaigns/{id}/preview/",
      "POST /api/v1/admin/tools/mass-mailer/campaigns/{id}/send/"
    ],
    stats: [
      { label: "Recipients", value: "128", detail: "Filtered clients" },
      { label: "Drafts", value: "4", detail: "Campaign drafts" },
      { label: "Sent", value: "21", detail: "Completed campaigns" }
    ],
    columns: [
      { header: "Campaign", accessor: "campaign" },
      { header: "Audience", accessor: "audience" },
      { header: "Status", accessor: "status" },
      { header: "Updated", accessor: "updated" }
    ],
    rows: [
      { campaign: "Hosting renewal reminder", audience: "Hosting clients", status: "Draft", updated: "Today" },
      { campaign: "Migration offer", audience: "New clients", status: "Ready", updated: "Yesterday" },
      { campaign: "Security notice", audience: "All clients", status: "Sent", updated: "Apr 30" }
    ],
    fields: [
      { label: "Campaign Subject", placeholder: "Important update from Octalve Cloud" },
      { label: "Audience", as: "select", options: ["All Clients", "Hosting Clients", "VPS Clients", "Unpaid Invoices", "Active Services"], value: "All Clients" },
      { label: "Sender", value: "Octalve Cloud <hello@octalve.cloud>" },
      { label: "Schedule", as: "select", options: ["Send Now", "Schedule Later", "Save Draft"], value: "Save Draft" },
      { label: "Email Body", as: "textarea", placeholder: "Write campaign email content" }
    ]
  },

  utilities: {
    title: "Utilities",
    description:
      "Run safe maintenance checks, cache inspection, database health, queue health and system diagnostics.",
    icon: Wrench,
    backend: [
      "GET /api/v1/admin/tools/utilities/health/",
      "POST /api/v1/admin/tools/utilities/clear-cache/",
      "POST /api/v1/admin/tools/utilities/test-mail/",
      "POST /api/v1/admin/tools/utilities/test-queue/"
    ],
    stats: [
      { label: "API", value: "Healthy", detail: "Backend reachable" },
      { label: "Queue", value: "Pending", detail: "Awaiting worker setup" },
      { label: "Cache", value: "Ready", detail: "Redis planned" }
    ],
    columns: [
      { header: "Check", accessor: "check" },
      { header: "Target", accessor: "target" },
      { header: "Result", accessor: "result" },
      { header: "Status", accessor: "status" }
    ],
    rows: [
      { check: "Database", target: "PostgreSQL", result: "Connection planned", status: "Pending" },
      { check: "Queue", target: "Celery/Redis", result: "Worker not connected", status: "Pending" },
      { check: "Mail", target: "SMTP", result: "Configure mail settings", status: "Review" }
    ],
    fields: [
      { label: "Utility Action", as: "select", options: ["Clear Cache", "Test Mail", "Test Queue", "Run Health Check"], value: "Run Health Check" },
      { label: "Target", placeholder: "cache, mail, queue, database" },
      { label: "Run Mode", as: "select", options: ["Safe", "Dry Run", "Force"], value: "Safe" },
      { label: "Admin Note", as: "textarea", placeholder: "Reason for running this utility action" }
    ]
  }
};

export function AdminToolPage({ tool }: { tool: ToolKey }) {
  const config = toolConfigs[tool];
  const Icon = config.icon;

  return (
    <section className="mx-auto w-full max-w-[1520px] min-w-0 px-1 py-2 sm:px-2">
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <>
            <Button variant="secondary" disabled title="Not available until this tool is connected">Export</Button>
            <Button disabled title="Not available until this tool is connected">+ Add</Button>
          </>
        }
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        {config.stats.map((stat) => (
          <Card padded key={stat.label}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div>
                <span className="block text-xs font-medium text-console-muted">{stat.label}</span>
                <strong className="mt-1 block text-lg font-medium text-console-ink">Not connected</strong>
                <p className="mt-2 text-xs text-console-muted">Connect a verified service to enable this operation</p>
              </div>
              <div className="flex h-[2.625rem] w-[2.625rem] shrink-0 items-center justify-center rounded-[0.8125rem] bg-blue-50 text-console-primary">
                <Icon size={22} aria-hidden="true" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <Card padded>
          <div className="mb-4 flex min-w-0 flex-col gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-console-primary">Tool Configuration</p>
              <h2 className="mt-1 text-lg font-medium text-console-ink">{config.title} controls</h2>
              <p className="mt-1 text-[13px] leading-5 text-console-muted">Operations become available once this service is verified and connected.</p>
            </div>
          </div>

          <fieldset disabled className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            {config.fields.map((field) => (
              <FormField key={field.label} {...field} />
            ))}
          </fieldset>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled title="This tool is not connected">Reset</Button>
            <Button disabled title="This tool is not connected">Save</Button>
          </div>
        </Card>

        <Card padded>
          <div className="section-heading">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-console-primary">Service status</p>
              <h2 className="mt-1 text-lg font-medium text-console-ink">Connection required</h2>
              <p className="mt-1 text-[13px] leading-5 text-console-muted">This service is not currently available for administrative changes.</p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 text-[13px] leading-5 text-console-muted" role="status">No active service connection has been confirmed.</div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-5 text-amber-900">
            These tools should be protected with admin-only RBAC and every write action should create an audit log.
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <DataTable title={`${config.title} Records`} columns={config.columns} rows={config.rows} />
      </div>
    </section>
  );
}
