"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CreditCard,
  Download,
  Eye,
  FileText,
  LifeBuoy,
  Plus,
  Receipt,
  Search,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PremiumTable, type PremiumTableColumn } from "@/components/ui/PremiumTable";
import { invoices } from "@/lib/platform-data";

type InvoiceRow = (typeof invoices)[number] & {
  type: string;
  balanceState: string;
};

function cleanMoney(value: string) {
  return value.replace(/â‚¦/g, "₦");
}

const invoiceRows: InvoiceRow[] = invoices.map((invoice) => ({
  ...invoice,
  total: cleanMoney(invoice.total),
  paid: cleanMoney(invoice.paid),
  due: cleanMoney(invoice.due),
  type: invoice.status === "Paid" ? "Paid invoice" : "Pending payment",
  balanceState: invoice.status === "Paid" ? "Settled" : "Payment required",
}));

const columns: PremiumTableColumn<InvoiceRow>[] = [
  {
    key: "invoice",
    header: "Invoice",
    render: (row) => (
      <div className="premium-main-cell">
        <span className={row.status === "Paid" ? "premium-cell-icon green" : "premium-cell-icon orange"}>
          <FileText size={22} />
        </span>
        <div>
          <Link className="premium-primary-text" href={`/client/invoices/${row.id}`}>
            {row.id}
          </Link>
          <span className="premium-secondary-text">{row.type}</span>
        </div>
      </div>
    ),
  },
  {
    key: "total",
    header: "Total",
    render: (row) => (
      <div>
        <span className="premium-primary-text">{row.total}</span>
        <span className="premium-secondary-text">Invoice value</span>
      </div>
    ),
  },
  {
    key: "due",
    header: "Balance",
    render: (row) => (
      <div>
        <span className="premium-primary-text">{row.due}</span>
        <span className="premium-secondary-text">{row.balanceState}</span>
      </div>
    ),
  },
  {
    key: "date",
    header: "Issued",
    render: (row) => (
      <div>
        <span className="premium-primary-text">{row.date}</span>
        <span className="premium-secondary-text">Due {row.dueDate}</span>
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <span className={row.status === "Paid" ? "premium-status active" : "premium-status pending"}>
        <i />
        {row.status}
      </span>
    ),
  },
];

export default function Page() {
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredRows = useMemo(() => {
    if (activeFilter === "all") return invoiceRows;

    return invoiceRows.filter((invoice) => invoice.status.toLowerCase() === activeFilter);
  }, [activeFilter]);

  const totalInvoices = invoiceRows.length;
  const paidInvoices = invoiceRows.filter((invoice) => invoice.status === "Paid").length;
  const unpaidInvoices = invoiceRows.filter((invoice) => invoice.status !== "Paid").length;

  return (
    <main className="page-container">
      <PageHeader
        title="Invoices"
        description="View invoices, pay outstanding balances, download receipts and track billing history."
      />

      <section className="billing-summary-grid">
        <div className="billing-summary-card dark">
          <div>
            <span>Total invoices</span>
            <strong>{totalInvoices}</strong>
            <p>All billing records in your account.</p>
          </div>
          <Receipt size={30} />
        </div>

        <div className="billing-summary-card">
          <div>
            <span>Paid invoices</span>
            <strong>{paidInvoices}</strong>
            <p>Payments confirmed and settled.</p>
          </div>
          <CreditCard size={28} />
        </div>

        <div className="billing-summary-card">
          <div>
            <span>Pending payment</span>
            <strong>{unpaidInvoices}</strong>
            <p>Invoices still requiring action.</p>
          </div>
          <Wallet size={28} />
        </div>
      </section>

      <PremiumTable
        title="My Invoices"
        description="Search, filter and manage all invoices linked to your services, renewals and orders."
        rows={filteredRows}
        columns={columns}
        filters={[
          { label: "All invoices", value: "all" },
          { label: "Paid", value: "paid" },
          { label: "Unpaid", value: "unpaid" },
        ]}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        searchPlaceholder="Search invoices, status or dates..."
        searchKeys={["id", "client", "status", "date", "dueDate", "total"]}
        primaryAction={
          <Link className="client-add-service" href="/client/order">
            <Plus size={18} />
            New Order
          </Link>
        }
        rowActions={(row) => [
          {
            label: "View invoice",
            href: `/client/invoices/${row.id}`,
            icon: <Eye size={16} />,
          },
          {
            label: row.status === "Paid" ? "View receipt" : "Pay now",
            href: row.status === "Paid"
              ? `/client/invoices/${row.id}`
              : `/client/order/checkout?invoice=${row.id}`,
            icon: <CreditCard size={16} />,
          },
          {
            label: "Download PDF",
            href: `/client/invoices/${row.id}?download=pdf`,
            icon: <Download size={16} />,
          },
          {
            label: "Get billing support",
            href: `/client/support/new?invoice=${row.id}`,
            icon: <LifeBuoy size={16} />,
          },
        ]}
      />
    </main>
  );
}
