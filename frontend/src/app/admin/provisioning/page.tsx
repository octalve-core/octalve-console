"use client";

import { Clock, RotateCcw, Server, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  AdminPremiumTable,
  PremiumStatusPill,
} from "@/components/modules/admin/AdminPremiumTable";
import { services } from "@/lib/platform-data";

type ProvisioningRow = {
  id: string;
  serviceId: string;
  task: string;
  service: string;
  customer: string;
  adapter: string;
  status: string;
  priority: string;
  nextRun: string;
};

const provisioningRows: ProvisioningRow[] = services.map((service, index) => {
  const isPending = service.status === "Pending";

  return {
    id: `QUEUE-${String(index + 1).padStart(3, "0")}`,
    serviceId: service.id,
    task: isPending ? "Provision service" : "Usage and renewal sync",
    service: service.label,
    customer: service.customer,
    adapter: service.adapter,
    status: isPending ? "Pending" : "Ready",
    priority: isPending ? "High" : "Normal",
    nextRun: isPending ? "Immediate" : "Next cron cycle",
  };
});

const provisioningFilters = [
  { label: "All tasks", value: "all" },
  { label: "Pending", value: "Pending" },
  { label: "Ready", value: "Ready" },
];

export default function Page() {
  const pending = provisioningRows.filter((item) => item.status === "Pending").length;
  const ready = provisioningRows.filter((item) => item.status === "Ready").length;

  return (
    <main className="page-container">
      <PageHeader
        title="Provisioning Queue"
        description="Monitor service provisioning, renewal sync, suspension, unsuspension and adapter automation tasks."
        actions={<Button href="/admin/tools/service-queue">Queue Rules</Button>}
      />

      <AdminPremiumTable<ProvisioningRow>
        title="Automation Queue"
        description="This queue prepares the admin view for DirectAdmin, cPanel, VPS, domain, SSL, email and backup adapter jobs."
        rows={provisioningRows}
        rowKey={(row) => row.id}
        searchPlaceholder="Search queue, service, customer, adapter..."
        searchText={(row) => `${row.id} ${row.serviceId} ${row.task} ${row.service} ${row.customer} ${row.adapter} ${row.status} ${row.priority}`}
        filters={provisioningFilters}
        filterValue={(row) => row.status}
        stats={[
          { label: "Queue tasks", value: String(provisioningRows.length), helper: "Current automation jobs" },
          { label: "Pending", value: String(pending), helper: "Requires provider action" },
          { label: "Ready", value: String(ready), helper: "Prepared for sync" },
          { label: "Adapters", value: "Connected", helper: "Provider-independent workflow" },
        ]}
        columns={[
          {
            label: "Task",
            className: "wide",
            render: (row) => (
              <div className="premium-resource-main">
                <span className="premium-resource-icon blue">
                  <Zap size={21} />
                </span>
                <div>
                  <strong>{row.task}</strong>
                  <span>{row.id} · {row.serviceId}</span>
                </div>
              </div>
            ),
          },
          {
            label: "Service",
            render: (row) => (
              <div className="premium-mini-meta">
                <Server size={16} />
                <span>{row.service}</span>
              </div>
            ),
          },
          {
            label: "Priority",
            render: (row) => (
              <div className="premium-mini-meta">
                <RotateCcw size={16} />
                <span>{row.priority}</span>
              </div>
            ),
          },
          {
            label: "Next Run",
            render: (row) => (
              <div className="premium-mini-meta">
                <Clock size={16} />
                <span>{row.nextRun}</span>
              </div>
            ),
          },
          {
            label: "Status",
            render: (row) => <PremiumStatusPill status={row.status} />,
          },
        ]}
        primaryAction={{
          label: "Run",
          href: (row) => `/admin/provisioning/${row.id}`,
        }}
        rowActions={[
          { label: "View service", href: (row) => `/admin/billing/services/${row.serviceId}` },
          { label: "View adapter", href: () => "/admin/settings/providers" },
          { label: "Retry task" },
          { label: "Mark failed", tone: "danger" },
        ]}
      />
    </main>
  );
}
