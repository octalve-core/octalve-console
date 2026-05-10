export type AdminOperationKey =
  | "support"
  | "departments"
  | "responses"
  | "knowledge-base"
  | "audit-logs"
  | "reports"
  | "notifications";

export type AdminOperationRecord = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  status: string;
  date?: string;
  actionHref: string;
};

export const adminOperationsDemo: Record<AdminOperationKey, AdminOperationRecord[]> = {
  support: [
    {
      id: "TKT-001",
      title: "DNS setup issue",
      subtitle: "Client needs help connecting domain to hosting",
      meta: "Technical Support",
      status: "Open",
      date: "May 30, 2026",
      actionHref: "/admin/support/TKT-001",
    },
    {
      id: "TKT-002",
      title: "Invoice payment confirmation",
      subtitle: "Client sent transfer receipt for manual approval",
      meta: "Billing",
      status: "Pending",
      date: "May 29, 2026",
      actionHref: "/admin/support/TKT-002",
    },
  ],
  departments: [
    {
      id: "DEP-001",
      title: "Technical Support",
      subtitle: "Hosting, domains, DNS, SSL and provisioning issues",
      meta: "Support Department",
      status: "Active",
      date: "Enabled",
      actionHref: "/admin/support/departments",
    },
    {
      id: "DEP-002",
      title: "Billing",
      subtitle: "Invoices, payments, wallet and renewals",
      meta: "Support Department",
      status: "Active",
      date: "Enabled",
      actionHref: "/admin/support/departments",
    },
  ],
  responses: [
    {
      id: "RES-001",
      title: "DNS setup response",
      subtitle: "Template response for nameserver and DNS setup",
      meta: "Predefined Response",
      status: "Active",
      date: "Updated today",
      actionHref: "/admin/support/responses",
    },
    {
      id: "RES-002",
      title: "Payment confirmation response",
      subtitle: "Template response for manual payment confirmation",
      meta: "Predefined Response",
      status: "Active",
      date: "Updated today",
      actionHref: "/admin/support/responses",
    },
  ],
  "knowledge-base": [
    {
      id: "KB-001",
      title: "How to point a domain to Octalve hosting",
      subtitle: "DNS and nameserver setup guide",
      meta: "Domains",
      status: "Published",
      date: "May 30, 2026",
      actionHref: "/admin/knowledge-base/KB-001",
    },
    {
      id: "KB-002",
      title: "How hosting renewals work",
      subtitle: "Billing, due dates and renewal workflow",
      meta: "Billing",
      status: "Draft",
      date: "May 28, 2026",
      actionHref: "/admin/knowledge-base/KB-002",
    },
  ],
  "audit-logs": [
    {
      id: "AUD-001",
      title: "Admin login",
      subtitle: "Octalve Admin signed in successfully",
      meta: "Authentication",
      status: "Success",
      date: "Today",
      actionHref: "/admin/audit-logs",
    },
    {
      id: "AUD-002",
      title: "Provider updated",
      subtitle: "DirectAdmin provider configuration changed",
      meta: "Infrastructure",
      status: "Info",
      date: "Today",
      actionHref: "/admin/audit-logs",
    },
  ],
  reports: [
    {
      id: "RPT-001",
      title: "Revenue summary",
      subtitle: "Total revenue, paid invoices and gateway performance",
      meta: "Financial",
      status: "Ready",
      date: "Today",
      actionHref: "/admin/reports",
    },
    {
      id: "RPT-002",
      title: "Provisioning health",
      subtitle: "Queued, failed, pending and completed tasks",
      meta: "Operations",
      status: "Ready",
      date: "Today",
      actionHref: "/admin/reports",
    },
  ],
  notifications: [
    {
      id: "NTF-001",
      title: "Invoice created",
      subtitle: "Sent when a new invoice is generated",
      meta: "Billing Template",
      status: "Active",
      date: "Updated today",
      actionHref: "/admin/settings/notifications/NTF-001",
    },
    {
      id: "NTF-002",
      title: "Ticket reply",
      subtitle: "Sent when support replies to a ticket",
      meta: "Support Template",
      status: "Active",
      date: "Updated today",
      actionHref: "/admin/settings/notifications/NTF-002",
    },
  ],
};