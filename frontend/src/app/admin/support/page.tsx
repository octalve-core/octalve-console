"use client";

import { Clock, Headphones, MessageSquare, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  AdminPremiumTable,
  PremiumStatusPill,
} from "@/components/modules/admin/AdminPremiumTable";
import { tickets } from "@/lib/platform-data";

type TicketRow = (typeof tickets)[number];

const ticketFilters = [
  { label: "All tickets", value: "all" },
  { label: "Open", value: "Open" },
  { label: "Waiting Customer", value: "Waiting Customer" },
  { label: "Closed", value: "Closed" },
];

export default function Page() {
  const open = tickets.filter((item) => item.status === "Open").length;
  const waiting = tickets.filter((item) => item.status === "Waiting Customer").length;
  const high = tickets.filter((item) => item.priority === "High").length;

  return (
    <main className="page-container">
      <PageHeader
        title="Support Tickets"
        description="Manage customer requests, staff replies, departments, priorities and support history."
        actions={<Button href="/admin/support/new">+ New Ticket</Button>}
      />

      <AdminPremiumTable<TicketRow>
        title="Ticket Inbox"
        description="Support tickets should be easy to triage, reply, assign, close and connect to services or orders."
        rows={tickets}
        rowKey={(row) => row.id}
        searchPlaceholder="Search tickets, clients, subjects..."
        searchText={(row) =>
          `${row.id} ${row.customer} ${row.subject} ${row.department} ${row.priority} ${row.status} ${row.lastReply ?? ""}`
        }
        filters={ticketFilters}
        filterValue={(row) => row.status}
        stats={[
          { label: "Tickets", value: String(tickets.length), helper: "Total support records" },
          { label: "Open", value: String(open), helper: "Needs staff attention" },
          { label: "Waiting client", value: String(waiting), helper: "Awaiting customer response" },
          { label: "High priority", value: String(high), helper: "Urgent support queue" },
        ]}
        columns={[
          {
            label: "Ticket",
            className: "wide",
            render: (row) => (
              <div className="premium-resource-main">
                <span className="premium-resource-icon blue">
                  <MessageSquare size={21} />
                </span>
                <div>
                  <strong>{row.subject}</strong>
                  <span>{row.id} · {row.department}</span>
                </div>
              </div>
            ),
          },
          {
            label: "Customer",
            render: (row) => (
              <div className="premium-mini-meta">
                <UserRound size={16} />
                <span>{row.customer}</span>
              </div>
            ),
          },
          {
            label: "Priority",
            render: (row) => (
              <div className="premium-mini-meta">
                <Headphones size={16} />
                <span>{row.priority}</span>
              </div>
            ),
          },
          {
            label: "Last Reply",
            render: (row) => (
              <div className="premium-mini-meta">
                <Clock size={16} />
                <span>{row.lastReply ?? "No reply yet"}</span>
              </div>
            ),
          },
          {
            label: "Status",
            render: (row) => <PremiumStatusPill status={row.status} />,
          },
        ]}
        primaryAction={{
          label: "Reply",
          href: (row) => `/admin/support/${row.id}`,
        }}
        rowActions={[
          { label: "Open ticket", href: (row) => `/admin/support/${row.id}` },
          { label: "Assign staff" },
          { label: "Use response template", href: () => "/admin/support/responses" },
          { label: "Move department", href: () => "/admin/support/departments" },
          { label: "Close ticket", tone: "danger" },
        ]}
      />
    </main>
  );
}
