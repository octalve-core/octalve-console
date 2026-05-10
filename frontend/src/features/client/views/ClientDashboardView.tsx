"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, Globe2, PackageCheck, Ticket, WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { MetricCard } from "@/components/data/MetricCard";
import { ResponsiveGrid } from "@/components/data/ResponsiveGrid";
import { LoadingState } from "@/components/feedback/LoadingState";
import { useAuth } from "@/context/AuthContext";
import { clientApi } from "@/lib/api/endpoints";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { ClientHero } from "../components/ClientHero";
import { ClientSectionCard } from "../components/ClientSectionCard";
import { clientDemo } from "../data/client-demo-data";

type ClientCounts = {
  services: number;
  invoices: number;
  domains: number;
  tickets: number;
  wallet: number;
};

function getListCount(value: unknown) {
  const data = value as { count?: number; results?: unknown[] } | unknown[];

  if (Array.isArray(data)) return data.length;
  if (typeof data?.count === "number") return data.count;
  if (Array.isArray(data?.results)) return data.results.length;

  return 0;
}

export function ClientDashboardView() {
  const { user } = useAuth();

  const [counts, setCounts] = useState<ClientCounts>({
    services: 0,
    invoices: 0,
    domains: 0,
    tickets: 0,
    wallet: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const [services, invoices, domains, tickets, wallet] = await Promise.allSettled([
          clientApi.services(),
          clientApi.invoices(),
          clientApi.domains(),
          clientApi.tickets(),
          clientApi.wallet(),
        ]);

        if (!active) return;

        const walletValue =
          wallet.status === "fulfilled" &&
          typeof (wallet.value as { available?: unknown })?.available !== "undefined"
            ? Number((wallet.value as { available?: unknown }).available)
            : 0;

        setCounts({
          services: services.status === "fulfilled" ? getListCount(services.value) : clientDemo.services.length,
          invoices: invoices.status === "fulfilled" ? getListCount(invoices.value) : clientDemo.invoices.length,
          domains: domains.status === "fulfilled" ? getListCount(domains.value) : clientDemo.domains.length,
          tickets: tickets.status === "fulfilled" ? getListCount(tickets.value) : clientDemo.support.length,
          wallet: Number.isFinite(walletValue) ? walletValue : 0,
        });
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const firstName = useMemo(() => {
    const source = user?.name || user?.full_name || "Client";
    return source.split(" ")[0] || "Client";
  }, [user]);

  return (
    <DashboardShell
      role="client"
      title="Client dashboard"
      description="Manage services, invoices, domains, wallet, and support."
    >
      <div className="space-y-6">
        <ClientHero name={firstName} />

        {isLoading ? (
          <LoadingState title="Loading client dashboard" description="Fetching your account summary from the API." />
        ) : (
          <ResponsiveGrid columns="4">
            <MetricCard
              label="Active services"
              value={formatNumber(counts.services)}
              description="Hosting and cloud services"
              icon={<PackageCheck className="h-5 w-5" />}
            />
            <MetricCard
              label="Unpaid invoices"
              value={formatNumber(counts.invoices)}
              description="Invoices and renewals"
              icon={<CreditCard className="h-5 w-5" />}
            />
            <MetricCard
              label="Domains"
              value={formatNumber(counts.domains)}
              description="Domain names and DNS"
              icon={<Globe2 className="h-5 w-5" />}
            />
            <MetricCard
              label="Wallet balance"
              value={formatCurrency(counts.wallet)}
              description="Available wallet credit"
              icon={<WalletCards className="h-5 w-5" />}
            />
            <MetricCard
              label="Open tickets"
              value={formatNumber(counts.tickets)}
              description="Support conversations"
              icon={<Ticket className="h-5 w-5" />}
            />
          </ResponsiveGrid>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <ClientSectionCard
            title="Your services"
            description="Manage your most recent active products from one place."
            href="/client/services"
            records={clientDemo.services}
          />

          <ClientSectionCard
            title="Recent invoices"
            description="Track payments, renewals, and pending invoices."
            href="/client/invoices"
            records={clientDemo.invoices}
          />
        </div>
      </div>
    </DashboardShell>
  );
}