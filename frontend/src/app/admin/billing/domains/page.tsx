"use client";

import { CalendarDays, Globe2, RefreshCcw, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  AdminPremiumTable,
  cleanCurrency,
  PremiumStatusPill,
} from "@/components/modules/admin/AdminPremiumTable";
import { domains } from "@/lib/platform-data";

type DomainRow = (typeof domains)[number];

const domainFilters = [
  { label: "All domains", value: "all" },
  { label: "Active", value: "Active" },
  { label: "Pending", value: "Pending" },
  { label: "Suspended", value: "Suspended" },
];

export default function Page() {
  const active = domains.filter((item) => item.status === "Active").length;
  const autoRenew = domains.filter((item) => item.autoRenew === "On").length;

  return (
    <main className="page-container">
      <PageHeader
        title="Domains"
        description="Manage domain registrations, renewals, nameservers, DNS automation and registrar sync."
        actions={<Button href="/admin/billing/domains/new">+ Add Domain</Button>}
      />

      <AdminPremiumTable<DomainRow>
        title="Domain Portfolio"
        description="Admin-facing domain records can stay mapped to registrar adapters while clients only see renewal, DNS and security controls."
        rows={domains}
        rowKey={(row) => row.id}
        searchPlaceholder="Search domains, clients, registrar..."
        searchText={(row) =>
          `${row.id} ${row.domain} ${row.client} ${row.registrar} ${row.price} ${row.renewal} ${row.expiry} ${row.status}`
        }
        filters={domainFilters}
        filterValue={(row) => row.status}
        stats={[
          { label: "Domains", value: String(domains.length), helper: "Total domain records" },
          { label: "Active", value: String(active), helper: "Currently active" },
          { label: "Auto-renew", value: String(autoRenew), helper: "Renewal protection enabled" },
          { label: "DNS sync", value: "Ready", helper: "Registrar/DNS adapter prepared" },
        ]}
        columns={[
          {
            label: "Domain",
            className: "wide",
            render: (row) => (
              <div className="premium-resource-main">
                <span className="premium-resource-icon blue">
                  <Globe2 size={21} />
                </span>
                <div>
                  <strong>{row.domain}</strong>
                  <span>{row.id} · {row.client}</span>
                </div>
              </div>
            ),
          },
          {
            label: "Renewal",
            render: (row) => (
              <div className="premium-mini-meta">
                <RefreshCcw size={16} />
                <span>{row.renewal}</span>
              </div>
            ),
          },
          {
            label: "Expiry",
            render: (row) => (
              <div className="premium-mini-meta">
                <CalendarDays size={16} />
                <span>{row.expiry}</span>
              </div>
            ),
          },
          {
            label: "Protection",
            render: (row) => (
              <div className="premium-mini-meta">
                <ShieldCheck size={16} />
                <span>Auto-renew {row.autoRenew}</span>
              </div>
            ),
          },
          {
            label: "Price",
            render: (row) => (
              <div className="premium-amount-cell">
                <strong>{cleanCurrency(row.price)}</strong>
                <span>Registrar billing</span>
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
          href: (row) => `/admin/billing/domains/${row.id}`,
        }}
        rowActions={[
          { label: "Edit domain", href: (row) => `/admin/billing/domains/${row.id}` },
          { label: "DNS records", href: (row) => `/admin/billing/domains/${row.id}` },
          { label: "Renew domain", href: (row) => `/admin/billing/domains/${row.id}` },
          { label: "Disable auto-renew" },
          { label: "Suspend domain", tone: "danger" },
        ]}
      />
    </main>
  );
}
