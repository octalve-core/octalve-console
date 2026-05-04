"use client";

import { Activity, PlugZap, Server, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  AdminPremiumTable,
  PremiumStatusPill,
} from "@/components/modules/admin/AdminPremiumTable";
import { adapters } from "@/lib/platform-data";

type AdapterRow = (typeof adapters)[number];

const adapterFilters = [
  { label: "All adapters", value: "all" },
  { label: "Ready", value: "Ready" },
  { label: "Ready contract", value: "Ready contract" },
  { label: "Planned", value: "Planned" },
];

export default function Page() {
  const ready = adapters.filter((item) => item.status === "Ready" || item.status === "Ready contract").length;
  const planned = adapters.filter((item) => item.status === "Planned").length;
  const categories = new Set(adapters.map((item) => item.category)).size;

  return (
    <main className="page-container">
      <PageHeader
        title="Servers & Adapters"
        description="Manage provider adapters for hosting, VPS, domains, SSL, email, DNS, backups and custom infrastructure."
        actions={<Button href="/admin/servers/new">+ Add Provider</Button>}
      />

      <AdminPremiumTable<AdapterRow>
        title="Provider Adapter Registry"
        description="Adapters keep Octalve Console provider-independent while still allowing DirectAdmin, cPanel, VPS, registrar and DNS automation."
        rows={adapters}
        rowKey={(row) => row.name}
        searchPlaceholder="Search adapters, categories, readiness..."
        searchText={(row) => `${row.name} ${row.category} ${row.status} ${row.description}`}
        filters={adapterFilters}
        filterValue={(row) => row.status}
        stats={[
          { label: "Adapters", value: String(adapters.length), helper: "Provider contracts" },
          { label: "Ready", value: String(ready), helper: "Usable or contract-ready" },
          { label: "Planned", value: String(planned), helper: "Future integrations" },
          { label: "Categories", value: String(categories), helper: "Infrastructure groups" },
        ]}
        columns={[
          {
            label: "Adapter",
            className: "wide",
            render: (row) => (
              <div className="premium-resource-main">
                <span className="premium-resource-icon blue">
                  <PlugZap size={21} />
                </span>
                <div>
                  <strong>{row.name}</strong>
                  <span>{row.description}</span>
                </div>
              </div>
            ),
          },
          {
            label: "Category",
            render: (row) => (
              <div className="premium-mini-meta">
                <Server size={16} />
                <span>{row.category}</span>
              </div>
            ),
          },
          {
            label: "Health",
            render: (row) => (
              <div className="premium-mini-meta">
                <Activity size={16} />
                <span>{row.status.includes("Ready") ? "Connection test ready" : "Not active yet"}</span>
              </div>
            ),
          },
          {
            label: "Security",
            render: () => (
              <div className="premium-mini-meta">
                <ShieldCheck size={16} />
                <span>Secrets stored server-side</span>
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
          href: (row) => `/admin/servers/${row.name}`,
        }}
        rowActions={[
          { label: "Edit provider", href: (row) => `/admin/servers/${row.name}` },
          { label: "Test connection" },
          { label: "View queue", href: () => "/admin/provisioning" },
          { label: "Provider settings", href: () => "/admin/settings/providers" },
          { label: "Disable adapter", tone: "danger" },
        ]}
      />
    </main>
  );
}
