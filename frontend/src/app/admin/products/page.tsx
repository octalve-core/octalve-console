"use client";

import { Boxes, Layers, Package, Server } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  AdminPremiumTable,
  PremiumStatusPill,
} from "@/components/modules/admin/AdminPremiumTable";
import { products } from "@/lib/platform-data";

type ProductRow = (typeof products)[number];

const productFilters = [
  { label: "All products", value: "all" },
  { label: "Active", value: "Active" },
  { label: "Planned", value: "Planned" },
];

export default function Page() {
  const activeProducts = products.filter((item) => item.status === "Active").length;
  const plannedProducts = products.filter((item) => item.status === "Planned").length;
  const categories = new Set(products.map((item) => item.category)).size;

  return (
    <main className="page-container">
      <PageHeader
        title="Products"
        description="Define service products and connect them to provider adapters without exposing provider complexity to clients."
        actions={<Button href="/admin/products/new">+ Add Product</Button>}
      />

      <AdminPremiumTable<ProductRow>
        title="Product Catalogue"
        description="Products are the main services clients can order: hosting, VPS, domains, SSL, email and backups."
        rows={products}
        rowKey={(row) => row.id}
        searchPlaceholder="Search products, categories, adapters..."
        searchText={(row) =>
          `${row.id} ${row.name} ${row.category} ${row.adapter} ${row.status} ${row.description ?? ""}`
        }
        filters={productFilters}
        filterValue={(row) => row.status}
        stats={[
          { label: "Total products", value: String(products.length), helper: "Available service lines" },
          { label: "Active", value: String(activeProducts), helper: "Visible for ordering" },
          { label: "Planned", value: String(plannedProducts), helper: "Prepared for future launch" },
          { label: "Categories", value: String(categories), helper: "Grouped service families" },
        ]}
        columns={[
          {
            label: "Product",
            className: "wide",
            render: (row) => (
              <div className="premium-resource-main">
                <span className="premium-resource-icon blue">
                  <Package size={21} />
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
                <Layers size={16} />
                <span>{row.category}</span>
              </div>
            ),
          },
          {
            label: "Adapter Mapping",
            render: (row) => (
              <div className="premium-mini-meta">
                <Server size={16} />
                <span>{row.adapter}</span>
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
          href: (row) => `/admin/products/${row.id}`,
        }}
        rowActions={[
          { label: "Edit product", href: (row) => `/admin/products/${row.id}` },
          { label: "View plans", href: () => "/admin/plans" },
          { label: "Provider settings", href: () => "/admin/settings/providers" },
          { label: "Archive product", tone: "danger" },
        ]}
      />
    </main>
  );
}
