"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { adminApi } from "@/lib/api/endpoints";
import { schemaApi } from "@/lib/api/schema-api";
import { AdminHero } from "../components/AdminHero";
import {AdminQuickActions} from "../components/AdminQuickActions";
import {AdminOverviewMetrics,type AdminOverviewCounts} from "../components/AdminOverviewMetrics";
import {Panel} from "@/components/design-system/Panel";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {ActionLink} from "@/components/design-system/ActionLink";

function getListCount(value: unknown) {
  const data = value as { count?: number; results?: unknown[] } | unknown[];

  if (Array.isArray(data)) return data.length;
  if (typeof data?.count === "number" && Number.isSafeInteger(data.count) && data.count >= 0) return data.count;
  if (Array.isArray(data?.results)) return data.results.length;

  return null;
}

export function AdminOverviewView() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<AdminOverviewCounts>({
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
      <div className="space-y-5">
        <AdminHero name={firstName} />
        <AdminQuickActions/>
        <AdminOverviewMetrics counts={counts} loading={isLoading}/>
        <WorkspaceGrid variant="overviewPair">
          <Panel>
            <h2 className="text-lg font-semibold text-console-ink">Invoice management</h2>
            <p className="mt-2 text-sm leading-6 text-console-muted">
              View issued invoices and their server-confirmed statuses in the billing centre.
            </p>
            <ActionLink href="/admin/billing/invoices" variant="outline" className="mt-5 w-full sm:w-auto">
              View invoices
            </ActionLink>
          </Panel>
          <Panel>
            <h2 className="text-lg font-semibold text-console-ink">Provisioning queue</h2>
            <p className="mt-2 text-sm leading-6 text-console-muted">
              Review actual provisioning tasks and operational states before taking any action.
            </p>
            <ActionLink href="/admin/provisioning" variant="outline" className="mt-5 w-full sm:w-auto">
              View provisioning tasks
            </ActionLink>
          </Panel>
        </WorkspaceGrid>
      </div>
    </DashboardShell>
  );
}