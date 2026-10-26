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
import { AdminHero } from "../components/AdminHero";
import {WorkspaceQuickActions} from "@/components/data/WorkspaceQuickActions";
import { AdminSectionCard } from "../components/AdminSectionCard";

type OverviewCounts = {
  customers: number | null;
  services: number | null;
  invoices: number | null;
  domains: number | null;
  providers: number | null;
  transactions: number | null;
};

function getListCount(value: unknown) {
  const data = value as { count?: number; results?: unknown[] } | unknown[];

  if (Array.isArray(data)) return data.length;
  if (typeof data?.count === "number" && Number.isSafeInteger(data.count) && data.count >= 0) return data.count;
  if (Array.isArray(data?.results)) return data.results.length;

  return null;
}

export function AdminOverviewView() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<OverviewCounts>({
    customers: null,
    services: null,
    invoices: null,
    domains: null,
    providers: null,
    transactions: null,
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
          customers: customers.status === "fulfilled" ? getListCount(customers.value) : null,
          services: services.status === "fulfilled" ? getListCount(services.value) : null,
          invoices: invoices.status === "fulfilled" ? getListCount(invoices.value) : null,
          domains: domains.status === "fulfilled" ? getListCount(domains.value) : null,
          providers: providers.status === "fulfilled" ? getListCount(providers.value) : null,
          transactions: transactions.status === "fulfilled" ? getListCount(transactions.value) : null,
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
        <WorkspaceQuickActions role="admin"/>

        {isLoading ? (
          <LoadingState title="Loading admin overview" description="Preparing your overview…" />
        ) : (
          <ResponsiveGrid columns="4">
            <MetricCard
              label="Customers" accent="blue"
              value={counts.customers === null ? "—" : formatNumber(counts.customers)}
              description="Registered client accounts"
              icon={<Users className="h-5 w-5" />}
            />
            <MetricCard
              label="Active services" accent="green"
              value={counts.services === null ? "—" : formatNumber(counts.services)}
              description="Hosting and cloud services"
              icon={<PackageCheck className="h-5 w-5" />}
            />
            <MetricCard
              label="Invoices" accent="orange"
              value={counts.invoices === null ? "—" : formatNumber(counts.invoices)}
              description="Billing records"
              icon={<ReceiptText className="h-5 w-5" />}
            />
            <MetricCard
              label="Domains" accent="purple"
              value={counts.domains === null ? "—" : formatNumber(counts.domains)}
              description="Registered domains"
              icon={<Globe2 className="h-5 w-5" />}
            />
            <MetricCard
              label="Providers" accent="rose"
              value={counts.providers === null ? "—" : formatNumber(counts.providers)}
              description="Server and registrar adapters"
              icon={<Server className="h-5 w-5" />}
            />
            <MetricCard
              label="Transactions" accent="blue"
              value={counts.transactions === null ? "—" : formatNumber(counts.transactions)}
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
            records={[]}
          />

          <AdminSectionCard
            title="Provisioning queue"
            description="Monitor automation tasks before they affect customers."
            href="/admin/provisioning"
            records={[]}
          />
        </div>
      </div>
    </DashboardShell>
  );
}