"use client";

import { CalendarDays, CreditCard, Receipt, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  AdminPremiumTable,
  cleanCurrency,
  PremiumStatusPill,
} from "@/components/modules/admin/AdminPremiumTable";
import { invoices } from "@/lib/platform-data";

type InvoiceRow = (typeof invoices)[number];

const invoiceFilters = [
  { label: "All invoices", value: "all" },
  { label: "Paid", value: "Paid" },
  { label: "Unpaid", value: "Unpaid" },
];

export default function Page() {
  const paid = invoices.filter((item) => item.status === "Paid").length;
  const unpaid = invoices.filter((item) => item.status !== "Paid").length;

  return (
    <main className="page-container">
      <PageHeader
        title="Invoices"
        description="Review invoices, payment status, due dates and client billing action."
        actions={<Button href="/admin/billing/invoices/new">+ New Invoice</Button>}
      />

      <AdminPremiumTable<InvoiceRow>
        title="Invoice Control"
        description="Invoices are the billing source of truth before payment, wallet usage and provisioning."
        rows={invoices}
        rowKey={(row) => row.id}
        searchPlaceholder="Search invoices, clients, totals..."
        searchText={(row) => `${row.id} ${row.client} ${row.total} ${row.paid} ${row.due} ${row.status} ${row.date} ${row.dueDate}`}
        filters={invoiceFilters}
        filterValue={(row) => row.status}
        stats={[
          { label: "Total invoices", value: String(invoices.length), helper: "All billing records" },
          { label: "Paid", value: String(paid), helper: "Completed payments" },
          { label: "Unpaid", value: String(unpaid), helper: "Needs payment action" },
          { label: "Gateway flow", value: "Ready", helper: "Paystack, Flutterwave, wallet" },
        ]}
        columns={[
          {
            label: "Invoice",
            className: "wide",
            render: (row) => (
              <div className="premium-resource-main">
                <span className="premium-resource-icon blue">
                  <Receipt size={21} />
                </span>
                <div>
                  <strong>{row.id}</strong>
                  <span>Issued {row.date}</span>
                </div>
              </div>
            ),
          },
          {
            label: "Client",
            render: (row) => (
              <div className="premium-mini-meta">
                <UserRound size={16} />
                <span>{row.client}</span>
              </div>
            ),
          },
          {
            label: "Amount",
            render: (row) => (
              <div className="premium-amount-cell">
                <strong>{cleanCurrency(row.total)}</strong>
                <span>Paid {cleanCurrency(row.paid)} · Due {cleanCurrency(row.due)}</span>
              </div>
            ),
          },
          {
            label: "Due Date",
            render: (row) => (
              <div className="premium-mini-meta">
                <CalendarDays size={16} />
                <span>{row.dueDate}</span>
              </div>
            ),
          },
          {
            label: "Status",
            render: (row) => <PremiumStatusPill status={row.status} />,
          },
        ]}
        primaryAction={{
          label: "Open",
          href: (row) => `/admin/billing/invoices/${row.id}`,
        }}
        rowActions={[
          { label: "Edit invoice", href: (row) => `/admin/billing/invoices/${row.id}` },
          { label: "Record payment", href: () => "/admin/billing/transactions/new" },
          { label: "Send reminder" },
          { label: "View transactions", href: () => "/admin/billing/transactions" },
          { label: "Void invoice", tone: "danger" },
        ]}
      />
    </main>
  );
}
