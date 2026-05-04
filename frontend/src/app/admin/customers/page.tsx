"use client";

import { Mail, Phone, UserRound, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  AdminPremiumTable,
  cleanCurrency,
  PremiumStatusPill,
} from "@/components/modules/admin/AdminPremiumTable";
import { customers } from "@/lib/platform-data";

type CustomerRow = (typeof customers)[number];

const customerFilters = [
  { label: "All customers", value: "all" },
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
];

export default function Page() {
  const activeCustomers = customers.filter((item) => item.status === "Active").length;
  const totalServices = customers.reduce((total, item) => total + Number(item.services ?? 0), 0);
  const totalInvoices = customers.reduce((total, item) => total + Number(item.invoices ?? 0), 0);

  return (
    <main className="page-container">
      <PageHeader
        title="Customers"
        description="Manage clients, contact details, services, billing records, wallet balance and account status."
        actions={<Button href="/admin/customers/new">+ Add Customer</Button>}
      />

      <AdminPremiumTable<CustomerRow>
        title="Client Accounts"
        description="Each customer account connects to services, domains, invoices, support tickets and wallet movement."
        rows={customers}
        rowKey={(row) => row.id}
        searchPlaceholder="Search customers, emails, phone numbers..."
        searchText={(row) => `${row.id} ${row.name} ${row.email} ${row.phone ?? ""} ${row.status} ${row.balance ?? ""}`}
        filters={customerFilters}
        filterValue={(row) => row.status}
        stats={[
          { label: "Customers", value: String(customers.length), helper: "Total client accounts" },
          { label: "Active", value: String(activeCustomers), helper: "Currently enabled" },
          { label: "Services", value: String(totalServices), helper: "Attached service records" },
          { label: "Invoices", value: String(totalInvoices), helper: "Billing history count" },
        ]}
        columns={[
          {
            label: "Customer",
            className: "wide",
            render: (row) => (
              <div className="premium-resource-main">
                <span className="premium-resource-icon blue">
                  <UserRound size={21} />
                </span>
                <div>
                  <strong>{row.name}</strong>
                  <span>{row.id}</span>
                </div>
              </div>
            ),
          },
          {
            label: "Contact",
            render: (row) => (
              <div className="premium-contact-stack">
                <span><Mail size={15} /> {row.email}</span>
                <span><Phone size={15} /> {row.phone ?? "No phone"}</span>
              </div>
            ),
          },
          {
            label: "Wallet",
            render: (row) => (
              <div className="premium-mini-meta">
                <Wallet size={16} />
                <span>{cleanCurrency(row.balance)}</span>
              </div>
            ),
          },
          {
            label: "Linked Records",
            render: (row) => (
              <div className="premium-record-pair">
                <span>{row.services ?? 0} services</span>
                <span>{row.invoices ?? 0} invoices</span>
              </div>
            ),
          },
          {
            label: "Status",
            render: (row) => <PremiumStatusPill status={row.status} />,
          },
        ]}
        primaryAction={{
          label: "Manage",
          href: (row) => `/admin/customers/${row.id}`,
        }}
        rowActions={[
          { label: "Edit customer", href: (row) => `/admin/customers/${row.id}` },
          { label: "View services", href: () => "/admin/billing/services" },
          { label: "View invoices", href: () => "/admin/billing/invoices" },
          { label: "Open ticket", href: () => "/admin/support/new" },
          { label: "Suspend account", tone: "danger" },
        ]}
      />
    </main>
  );
}
