export type StaffResourceKey =
  | "customers"
  | "orders"
  | "provisioning"
  | "tickets"
  | "knowledgeBase";

export type StaffRecord = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  status: string;
  date?: string;
  actionHref: string;
};

export const staffDemo: Record<StaffResourceKey, StaffRecord[]> = {
  customers: [
    {
      id: "CUS-001",
      title: "Brandde Studio",
      subtitle: "brandde@example.com",
      meta: "Assigned client",
      status: "Active",
      date: "May 30, 2026",
      actionHref: "/staff/customers",
    },
    {
      id: "CUS-002",
      title: "DataArena Labs",
      subtitle: "hello@dataarena.ng",
      meta: "Hosting client",
      status: "Pending",
      date: "May 29, 2026",
      actionHref: "/staff/customers",
    },
  ],
  orders: [
    {
      id: "ORD-001",
      title: "Web Hosting · Business",
      subtitle: "brandde.com",
      meta: "Needs provisioning check",
      status: "Pending",
      date: "Today",
      actionHref: "/staff/orders",
    },
    {
      id: "ORD-002",
      title: "VPS Hosting · VPS-1",
      subtitle: "api.brandde.com",
      meta: "Provider review",
      status: "Pending",
      date: "Today",
      actionHref: "/staff/orders",
    },
  ],
  provisioning: [
    {
      id: "TSK-001",
      title: "Create DirectAdmin account",
      subtitle: "brandde.com · Business plan",
      meta: "Automation queue",
      status: "Pending",
      date: "Today",
      actionHref: "/staff/provisioning",
    },
    {
      id: "TSK-002",
      title: "Verify nameserver update",
      subtitle: "brandde.ng",
      meta: "Domain task",
      status: "Open",
      date: "Today",
      actionHref: "/staff/provisioning",
    },
  ],
  tickets: [
    {
      id: "TKT-001",
      title: "DNS setup issue",
      subtitle: "Client needs help connecting domain",
      meta: "Technical Support",
      status: "Open",
      date: "Today",
      actionHref: "/staff/tickets",
    },
    {
      id: "TKT-002",
      title: "Payment confirmation",
      subtitle: "Manual transfer needs review",
      meta: "Billing",
      status: "Pending",
      date: "Yesterday",
      actionHref: "/staff/tickets",
    },
  ],
  knowledgeBase: [
    {
      id: "KB-001",
      title: "How to point a domain to Octalve hosting",
      subtitle: "DNS and nameserver guide",
      meta: "Domains",
      status: "Published",
      date: "May 30, 2026",
      actionHref: "/staff/knowledge-base/KB-001",
    },
    {
      id: "KB-002",
      title: "How renewals work",
      subtitle: "Invoices, due dates, and renewal workflow",
      meta: "Billing",
      status: "Draft",
      date: "May 29, 2026",
      actionHref: "/staff/knowledge-base/KB-002",
    },
  ],
};