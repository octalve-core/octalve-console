"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Eye,
  Headphones,
  LifeBuoy,
  MessageCircle,
  Plus,
  RefreshCcw,
  Ticket,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PremiumTable, type PremiumTableColumn } from "@/components/ui/PremiumTable";
import { tickets } from "@/lib/platform-data";

type TicketRow = (typeof tickets)[number] & {
  responseState: string;
};

const ticketRows: TicketRow[] = tickets.map((ticket) => ({
  ...ticket,
  responseState:
    ticket.status.toLowerCase().includes("customer")
      ? "Waiting for you"
      : ticket.status.toLowerCase().includes("open")
        ? "Support team active"
        : "Ticket updated",
}));

const columns: PremiumTableColumn<TicketRow>[] = [
  {
    key: "ticket",
    header: "Ticket",
    render: (row) => (
      <div className="premium-main-cell">
        <span className={row.priority === "High" ? "premium-cell-icon orange" : "premium-cell-icon"}>
          <Ticket size={22} />
        </span>
        <div>
          <Link className="premium-primary-text" href={`/client/support/${row.id}`}>
            {row.subject}
          </Link>
          <span className="premium-secondary-text">{row.id} · {row.department}</span>
        </div>
      </div>
    ),
  },
  {
    key: "priority",
    header: "Priority",
    render: (row) => (
      <div>
        <span className="premium-primary-text">{row.priority}</span>
        <span className="premium-secondary-text">Support priority</span>
      </div>
    ),
  },
  {
    key: "lastReply",
    header: "Last update",
    render: (row) => (
      <div>
        <span className="premium-primary-text">{row.lastReply}</span>
        <span className="premium-secondary-text">{row.responseState}</span>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <span className={row.status.toLowerCase().includes("open") ? "premium-status active" : "premium-status pending"}>
        <i />
        {row.status}
      </span>
    ),
  },
];

export default function Page() {
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredRows = useMemo(() => {
    if (activeFilter === "all") return ticketRows;

    if (activeFilter === "open") {
      return ticketRows.filter((ticket) => !ticket.status.toLowerCase().includes("closed"));
    }

    if (activeFilter === "high") {
      return ticketRows.filter((ticket) => ticket.priority === "High");
    }

    return ticketRows;
  }, [activeFilter]);

  const openCount = ticketRows.filter((ticket) => !ticket.status.toLowerCase().includes("closed")).length;
  const highPriorityCount = ticketRows.filter((ticket) => ticket.priority === "High").length;

  return (
    <main className="page-container">
      <PageHeader
        title="Support"
        description="Track support conversations, open new tickets and follow updates from Octalve Cloud support."
      />

      <section className="support-command-grid">
        <div className="support-command-card dark">
          <span>
            <Headphones size={26} />
          </span>
          <div>
            <h2>Need help?</h2>
            <p>Open a support ticket and our team will respond from the right department.</p>
          </div>
          <Link href="/client/support/new">
            <Plus size={17} />
            Open Ticket
          </Link>
        </div>

        <div className="support-command-card">
          <span>
            <LifeBuoy size={24} />
          </span>
          <div>
            <strong>{openCount}</strong>
            <p>Open tickets</p>
          </div>
        </div>

        <div className="support-command-card">
          <span>
            <RefreshCcw size={24} />
          </span>
          <div>
            <strong>{highPriorityCount}</strong>
            <p>High priority</p>
          </div>
        </div>
      </section>

      <PremiumTable
        title="My Tickets"
        description="Search, filter and continue support conversations related to hosting, domains, billing and migration."
        rows={filteredRows}
        columns={columns}
        filters={[
          { label: "All tickets", value: "all" },
          { label: "Open", value: "open" },
          { label: "High priority", value: "high" },
        ]}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        searchPlaceholder="Search tickets, subjects or departments..."
        searchKeys={["id", "subject", "department", "priority", "status"]}
        primaryAction={
          <Link className="client-add-service" href="/client/support/new">
            <Plus size={18} />
            Open Ticket
          </Link>
        }
        rowActions={(row) => [
          {
            label: "Open conversation",
            href: `/client/support/${row.id}`,
            icon: <Eye size={16} />,
          },
          {
            label: "Reply ticket",
            href: `/client/support/${row.id}#reply`,
            icon: <MessageCircle size={16} />,
          },
          {
            label: "View knowledge base",
            href: "/client/knowledge-base",
            icon: <LifeBuoy size={16} />,
          },
        ]}
      />
    </main>
  );
}
