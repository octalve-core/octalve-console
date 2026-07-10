"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, Globe2, PackageCheck, ReceiptText, Server, Users } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { MetricCard } from "@/components/data/MetricCard";
import { ResponsiveGrid } from "@/components/data/ResponsiveGrid";
import { LoadingState } from "@/components/feedback/LoadingState";
import { useAuth } from "@/context/AuthContext";
import { adminApi } from "@/lib/api/endpoints";
import { schemaApi } from "@/lib/api/schema-api";
import { formatNumber } from "@/lib/formatters";
import { getFallbackData } from "@/lib/config/data-source";
import { AdminHero } from "../components/AdminHero";
import { AdminSectionCard } from "../components/AdminSectionCard";
import { adminDemo } from "../data/admin-demo-data";

type OverviewCounts = {
  customers: number;
  services: number;
  invoices: number;
  domains: number;
  providers: number;
  transactions: number;
};

function getListCount(value: unknown) {
  const data = value as { count?: number; results?: unknown[] } | unknown[];

  if (Array.isArray(data)) return data.length;
  if (typeof data?.count === "number") return data.count;
  if (Array.isArray(data?.results)) return data.results.length;

  return 0;
}

export function AdminOverviewView() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<OverviewCounts>({
    customers: 0,
    services: 0,
    invoices: 0,
    domains: 0,
    providers: 0,
    transactions: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      try {
        const [customers, services, invoices, domains, providers, transactions] = await Promise.allSettled([
          adminApi.customers(),
          schemaApi.services.services(),
          schemaApi.billing.invoices(),
          schemaApi.domains.domains(),
          schemaApi.providers.providers(),
          schemaApi.payments.transactions(),
        ]);

        if (!active) return;

        setCounts({
          customers: customers.status === "fulfilled" ? getListCount(customers.value) : getFallbackData(adminDemo.customers).length,
          services: services.status === "fulfilled" ? getListCount(services.value) : 0,
          invoices: invoices.status === "fulfilled" ? getListCount(invoices.value) : getFallbackData(adminDemo.invoices).length,
          domains: domains.status === "fulfilled" ? getListCount(domains.value) : getFallbackData(adminDemo.domains).length,
          providers: providers.status === "fulfilled" ? getListCount(providers.value) : getFallbackData(adminDemo.providers).length,
          transactions: transactions.status === "fulfilled" ? getListCount(transactions.value) : 0,
        });
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadOverview();

    return () => {
      active = false;
    };
  }, []);

  const firstName = useMemo(() => {
    const source = user?.name || user?.full_name || "Admin";
    return source.split(" ")[0] || "Admin";
  }, [user]);

  return (
    <DashboardShell
      role="admin"
      title="Admin overview"
      description="Manage hosting customers, services, billing, providers, and operations."
    >
      <div className="space-y-6">
        <AdminHero name={firstName} />

        {isLoading ? (
          <LoadingState title="Loading admin overview" description="Fetching current console metrics from the API." />
        ) : (
          <ResponsiveGrid columns="4">
            <MetricCard
              label="Customers"
              value={formatNumber(counts.customers)}
              description="Registered client accounts"
              icon={<Users className="h-5 w-5" />}
              trend={{ label: "Account health", value: "Stable", tone: "success" }}
            />
            <MetricCard
              label="Active services"
              value={formatNumber(counts.services)}
              description="Hosting and cloud services"
              icon={<PackageCheck className="h-5 w-5" />}
              trend={{ label: "Provisioning", value: "Ready", tone: "info" }}
            />
            <MetricCard
              label="Invoices"
              value={formatNumber(counts.invoices)}
              description="Billing records"
              icon={<ReceiptText className="h-5 w-5" />}
            />
            <MetricCard
              label="Domains"
              value={formatNumber(counts.domains)}
              description="Registered domains"
              icon={<Globe2 className="h-5 w-5" />}
              trend={{ label: "Auto-renew", value: "Enabled", tone: "success" }}
            />
            <MetricCard
              label="Providers"
              value={formatNumber(counts.providers)}
              description="Server and registrar adapters"
              icon={<Server className="h-5 w-5" />}
            />
            <MetricCard
              label="Transactions"
              value={formatNumber(counts.transactions)}
              description="Payment activity"
              icon={<CreditCard className="h-5 w-5" />}
            />
          </ResponsiveGrid>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <AdminSectionCard
            title="Recent invoices"
            description="Track unpaid, paid and pending billing activity."
            href="/admin/billing/invoices"
            records={getFallbackData(adminDemo.invoices)}
          />

          <AdminSectionCard
            title="Provisioning queue"
            description="Monitor automation tasks before they affect customers."
            href="/admin/provisioning"
            records={getFallbackData(adminDemo.provisioning)}
          />
        </div>
      </div>
    </DashboardShell>
  );
}