"use client";

import { CheckCircle2, Layers, ListChecks, Package } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  AdminPremiumTable,
  PremiumStatusPill,
} from "@/components/modules/admin/AdminPremiumTable";
import { plans } from "@/lib/platform-data";
import { money } from "@/lib/utils";

type PlanRow = (typeof plans)[number];

const planFilters = [
  { label: "All plans", value: "all" },
  { label: "Hosting", value: "Web Hosting" },
  { label: "VPS", value: "VPS Hosting" },
  { label: "Domains", value: "Domain Registration" },
  { label: "SSL", value: "SSL Certificates" },
];

function getPlanPrice(row: PlanRow) {
  const cyclePrices = row.cycles?.map((cycle) => cycle.price).filter((price) => price > 0) ?? [];
  const lowestCyclePrice = cyclePrices.length ? Math.min(...cyclePrices) : row.price;
  return money(lowestCyclePrice);
}

export default function Page() {
  const products = new Set(plans.map((item) => item.product)).size;
  const popular = plans.filter((item) => item.popular).length;
  const cycles = plans.reduce((total, item) => total + (item.cycles?.length ?? 0), 0);

  return (
    <main className="page-container">
      <PageHeader
        title="Plans & Pricing"
        description="Configure packages, billing cycles, features and provider mappings that customers can order directly."
        actions={<Button href="/admin/plans/new">+ Add Plan</Button>}
      />

      <AdminPremiumTable<PlanRow>
        title="Package Pricing"
        description="Plans should sync with products and provider package mapping so checkout, invoices and provisioning stay consistent."
        rows={plans}
        rowKey={(row) => row.id}
        searchPlaceholder="Search plans, products, features..."
        searchText={(row) =>
          `${row.id} ${row.name} ${row.product} ${row.adapter} ${row.currency} ${row.price} ${row.cycle} ${(row.features ?? []).join(" ")}`
        }
        filters={planFilters}
        filterValue={(row) => row.product}
        stats={[
          { label: "Plans", value: String(plans.length), helper: "Orderable packages" },
          { label: "Products", value: String(products), helper: "Connected service lines" },
          { label: "Popular", value: String(popular), helper: "Highlighted packages" },
          { label: "Billing cycles", value: String(cycles), helper: "Configured price options" },
        ]}
        columns={[
          {
            label: "Plan",
            className: "wide",
            render: (row) => (
              <div className="premium-resource-main">
                <span className="premium-resource-icon blue">
                  <ListChecks size={21} />
                </span>
                <div>
                  <strong>{row.name}</strong>
                  <span>{row.product} · {row.storage} · {row.bandwidth}</span>
                </div>
              </div>
            ),
          },
          {
            label: "Pricing",
            render: (row) => (
              <div className="premium-amount-cell">
                <strong>{getPlanPrice(row)}</strong>
                <span>{row.cycles?.length ?? 0} billing cycles</span>
              </div>
            ),
          },
          {
            label: "Features",
            render: (row) => (
              <div className="premium-mini-meta">
                <CheckCircle2 size={16} />
                <span>{row.features?.length ?? 0} features</span>
              </div>
            ),
          },
          {
            label: "Product",
            render: (row) => (
              <div className="premium-mini-meta">
                <Package size={16} />
                <span>{row.product}</span>
              </div>
            ),
          },
          {
            label: "Adapter",
            render: (row) => (
              <div className="premium-mini-meta">
                <Layers size={16} />
                <span>{row.adapter}</span>
              </div>
            ),
          },
          {
            label: "Status",
            render: () => <PremiumStatusPill status="Active" />,
          },
        ]}
        primaryAction={{
          label: "Manage",
          href: (row) => `/admin/plans/${row.id}`,
        }}
        rowActions={[
          { label: "Edit plan", href: (row) => `/admin/plans/${row.id}` },
          { label: "Edit product", href: () => "/admin/products" },
          { label: "Provider mapping", href: () => "/admin/settings/providers" },
          { label: "Preview checkout", href: (row) => `/client/order/checkout?plan=${row.id}` },
          { label: "Disable plan", tone: "danger" },
        ]}
      />
    </main>
  );
}

