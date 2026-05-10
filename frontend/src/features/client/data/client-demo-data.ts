import type { ResourceStatus } from "@/lib/api/types";

export type ClientRecord = {
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  amount?: string;
  status: ResourceStatus | string;
  date?: string;
  actionHref: string;
  score?: number;
};

export const clientDemo = {
  services: [
    {
      id: "SVC-HOST-001",
      title: "brandde.com",
      subtitle: "Web Hosting · SVC-HOST-001",
      meta: "Business · 1 Month @ ₦3,500",
      amount: "₦3,500",
      status: "Active",
      date: "May 30, 2026",
      actionHref: "/client/services/SVC-HOST-001",
      score: 98,
    },
    {
      id: "SVC-VPS-001",
      title: "api.brandde.com",
      subtitle: "VPS Hosting · SVC-VPS-001",
      meta: "VPS-1 · 1 Month @ ₦12,000",
      amount: "₦12,000",
      status: "Pending",
      date: "May 30, 2026",
      actionHref: "/client/services/SVC-VPS-001",
      score: 94,
    },
    {
      id: "SVC-EMAIL-001",
      title: "mail.brandde.com",
      subtitle: "Business Email · SVC-EMAIL-001",
      meta: "Professional Email · Monthly",
      amount: "₦2,000",
      status: "Active",
      date: "Jun 02, 2026",
      actionHref: "/client/services/SVC-EMAIL-001",
      score: 96,
    },
  ],
  domains: [
    {
      id: "DOM-001",
      title: "brandde.com",
      subtitle: "Primary business domain",
      meta: "Auto-renew enabled",
      amount: "₦14,500",
      status: "Active",
      date: "May 30, 2026",
      actionHref: "/client/domains/DOM-001",
      score: 98,
    },
    {
      id: "DOM-002",
      title: "brandde.ng",
      subtitle: "Nigeria market domain",
      meta: "Nameserver update pending",
      amount: "₦9,500",
      status: "Pending",
      date: "Jun 12, 2026",
      actionHref: "/client/domains/DOM-002",
      score: 89,
    },
  ],
  invoices: [
    {
      id: "INV-001",
      title: "Hosting renewal invoice",
      subtitle: "brandde.com · Business plan",
      meta: "Due today",
      amount: "₦3,500",
      status: "Unpaid",
      date: "May 30, 2026",
      actionHref: "/client/invoices/INV-001",
    },
    {
      id: "INV-002",
      title: "VPS setup invoice",
      subtitle: "api.brandde.com · VPS-1",
      meta: "Paid via Paystack",
      amount: "₦12,000",
      status: "Paid",
      date: "May 29, 2026",
      actionHref: "/client/invoices/INV-002",
    },
    {
      id: "INV-003",
      title: "Business email invoice",
      subtitle: "mail.brandde.com · Email hosting",
      meta: "Awaiting payment",
      amount: "₦2,000",
      status: "Pending",
      date: "May 28, 2026",
      actionHref: "/client/invoices/INV-003",
    },
  ],
  orders: [
    {
      id: "ORD-001",
      title: "Web Hosting · Business",
      subtitle: "brandde.com",
      meta: "Provisioned successfully",
      amount: "₦3,500",
      status: "Active",
      date: "May 30, 2026",
      actionHref: "/client/orders/ORD-001",
    },
    {
      id: "ORD-002",
      title: "VPS Hosting · VPS-1",
      subtitle: "api.brandde.com",
      meta: "Provisioning in review",
      amount: "₦12,000",
      status: "Pending",
      date: "May 29, 2026",
      actionHref: "/client/orders/ORD-002",
    },
  ],
  support: [
    {
      id: "TKT-001",
      title: "Help with DNS setup",
      subtitle: "Domain support",
      meta: "Last reply from support",
      amount: "Normal",
      status: "Open",
      date: "May 30, 2026",
      actionHref: "/client/support/TKT-001",
    },
    {
      id: "TKT-002",
      title: "Invoice confirmation",
      subtitle: "Billing support",
      meta: "Awaiting client reply",
      amount: "Low",
      status: "Pending",
      date: "May 28, 2026",
      actionHref: "/client/support/TKT-002",
    },
  ],
};

export type ClientResourceKey = keyof typeof clientDemo;