"use client";

import { CreditCard, KeyRound, ShieldCheck, ToggleLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  AdminPremiumTable,
  PremiumStatusPill,
} from "@/components/modules/admin/AdminPremiumTable";
import { gateways } from "@/lib/platform-data";

type GatewayRow = (typeof gateways)[number];

const gatewayFilters = [
  { label: "All gateways", value: "all" },
  { label: "Active", value: "Active" },
  { label: "Test", value: "Test" },
  { label: "Disabled", value: "Disabled" },
];

export default function Page() {
  const active = gateways.filter((item) => item.status === "Active").length;
  const test = gateways.filter((item) => item.status === "Test").length;
  const disabled = gateways.filter((item) => item.status === "Disabled").length;

  return (
    <main className="page-container">
      <PageHeader
        title="Payment Gateways"
        description="Configure Paystack, Flutterwave, bank transfer, wallet, crypto and manual payment options."
        actions={<Button href="/admin/gateways/new">+ Add Gateway</Button>}
      />

      <AdminPremiumTable<GatewayRow>
        title="Gateway Control"
        description="Gateways should initialize payments, verify callbacks, handle webhooks and update invoices automatically."
        rows={gateways}
        rowKey={(row) => row.id}
        searchPlaceholder="Search gateways, fields, status..."
        searchText={(row) =>
          `${row.id} ${row.name} ${row.summary} ${row.status} ${(row.fields ?? []).join(" ")}`
        }
        filters={gatewayFilters}
        filterValue={(row) => row.status}
        stats={[
          { label: "Gateways", value: String(gateways.length), helper: "Configured payment methods" },
          { label: "Active", value: String(active), helper: "Client-visible methods" },
          { label: "Test mode", value: String(test), helper: "Sandbox-ready gateways" },
          { label: "Disabled", value: String(disabled), helper: "Hidden methods" },
        ]}
        columns={[
          {
            label: "Gateway",
            className: "wide",
            render: (row) => (
              <div className="premium-resource-main">
                <span className="premium-resource-icon blue">
                  <CreditCard size={21} />
                </span>
                <div>
                  <strong>{row.name}</strong>
                  <span>{row.summary}</span>
                </div>
              </div>
            ),
          },
          {
            label: "Required Fields",
            render: (row) => (
              <div className="premium-record-pair">
                <span>{row.fields?.slice(0, 2).join(", ") || "No fields"}</span>
                <span>{row.fields && row.fields.length > 2 ? `+${row.fields.length - 2} more` : "Ready"}</span>
              </div>
            ),
          },
          {
            label: "Mode",
            render: (row) => (
              <div className="premium-mini-meta">
                <ToggleLeft size={16} />
                <span>{row.status === "Test" ? "Sandbox" : row.status === "Active" ? "Live-ready" : "Disabled"}</span>
              </div>
            ),
          },
          {
            label: "Security",
            render: () => (
              <div className="premium-mini-meta">
                <ShieldCheck size={16} />
                <span>Webhook secret required</span>
              </div>
            ),
          },
          {
            label: "Status",
            render: (row) => <PremiumStatusPill status={row.status} />,
          },
        ]}
        primaryAction={{
          label: "Configure",
          href: (row) => `/admin/gateways/${row.id}`,
        }}
        rowActions={[
          { label: "Edit gateway", href: (row) => `/admin/gateways/${row.id}` },
          { label: "API keys", href: (row) => `/admin/gateways/${row.id}` },
          { label: "Test connection" },
          { label: "Webhook setup" },
          { label: "Disable gateway", tone: "danger" },
        ]}
      />
    </main>
  );
}
