"use client";

import { CalendarDays, Receipt, ShoppingCart, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  AdminPremiumTable,
  cleanCurrency,
  PremiumStatusPill,
} from "@/components/modules/admin/AdminPremiumTable";
import { orders } from "@/lib/platform-data";

type OrderRow = (typeof orders)[number];

const orderFilters = [
  { label: "All orders", value: "all" },
  { label: "Provisioned", value: "Provisioned" },
  { label: "Pending provisioning", value: "Pending Provisioning" },
];

export default function Page() {
  const provisioned = orders.filter((item) => item.status === "Provisioned").length;
  const pending = orders.filter((item) => item.status === "Pending Provisioning").length;

  return (
    <main className="page-container">
      <PageHeader
        title="Orders"
        description="Track client purchases from checkout through payment confirmation and provisioning."
        actions={<Button href="/admin/orders/new">+ New Order</Button>}
      />

      <AdminPremiumTable<OrderRow>
        title="Order Management"
        description="Orders should move from pending payment to paid, then into the provisioning queue."
        rows={orders}
        rowKey={(row) => row.id}
        searchPlaceholder="Search orders, clients, products..."
        searchText={(row) => `${row.id} ${row.customer} ${row.product} ${row.total} ${row.status} ${row.date}`}
        filters={orderFilters}
        filterValue={(row) => row.status}
        stats={[
          { label: "Total orders", value: String(orders.length), helper: "All submitted orders" },
          { label: "Provisioned", value: String(provisioned), helper: "Completed service delivery" },
          { label: "Pending", value: String(pending), helper: "Awaiting provisioning action" },
          { label: "Automation", value: "Ready", helper: "Payment to queue flow" },
        ]}
        columns={[
          {
            label: "Order",
            className: "wide",
            render: (row) => (
              <div className="premium-resource-main">
                <span className="premium-resource-icon blue">
                  <ShoppingCart size={21} />
                </span>
                <div>
                  <strong>{row.id}</strong>
                  <span>{row.product}</span>
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
            label: "Total",
            render: (row) => (
              <div className="premium-amount-cell">
                <strong>{cleanCurrency(row.total)}</strong>
                <span>Order value</span>
              </div>
            ),
          },
          {
            label: "Date",
            render: (row) => (
              <div className="premium-mini-meta">
                <CalendarDays size={16} />
                <span>{row.date}</span>
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
          href: (row) => `/admin/orders/${row.id}`,
        }}
        rowActions={[
          { label: "View customer", href: () => "/admin/customers" },
          { label: "View invoice", href: () => "/admin/billing/invoices" },
          { label: "Send to provisioning", href: () => "/admin/provisioning" },
          { label: "Cancel order", tone: "danger" },
        ]}
      />
    </main>
  );
}
