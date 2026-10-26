"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useAutoSync } from "@/lib/hooks/useAutoSync";
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  ExternalLink,
  Globe2,
  Headphones,
  PackageCheck,
  Server,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ErrorState } from "@/components/feedback/ErrorState";
import { formatStatus, getStatusTone } from "@/lib/constants/status";
import { clientResourceConfig } from "../data/client-resource-config";
import type { ClientRecord, ClientResourceKey } from "../data/client-demo-data";
import { normalizeClientRecord, unwrapClientList } from "../utils/client-record-normalizer";

type ClientResourceDetailViewProps = {
  resource: ClientResourceKey;
};

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getResourceIcon(resource: ClientResourceKey) {
  if (resource === "services") return PackageCheck;
  if (resource === "domains") return Globe2;
  if (resource === "invoices") return CreditCard;
  if (resource === "orders") return ShoppingCart;
  return Headphones;
}

function getDetailActions(resource: ClientResourceKey, record: ClientRecord) {
  if (resource === "services") {
    return [
      { label: "View hosting status", href: `/client/services/${encodeURIComponent(String(record.id))}/hosting-status`, variant: "primary" as const },
      { label: "Request support", href: "/client/support/new", variant: "outline" as const },
    ];
  }

  if (resource === "domains") {
    return [{ label: "Get domain support", href: "/client/support/new", variant: "outline" as const }];
  }

  if (resource === "invoices") {
    return [{ label: "Back to invoices", href: "/client/invoices", variant: "outline" as const }];
  }

  if (resource === "orders") {
    return [
      { label: "View invoice", href: "/client/invoices", variant: "primary" as const },
      { label: "Contact support", href: "/client/support/new", variant: "outline" as const },
    ];
  }

  return [
    { label: "Reply ticket", href: `/client/support/${record.id}`, variant: "primary" as const },
    { label: "New ticket", href: "/client/support/new", variant: "outline" as const },
  ];
}

export function ClientResourceDetailView({ resource }: ClientResourceDetailViewProps) {
  const params = useParams();
  const id = decodeURIComponent(getParamValue(params.id));
  const config = clientResourceConfig[resource];
  const Icon = getResourceIcon(resource);

  const [record, setRecord] = useState<ClientRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecord(quiet = false) {
    setError("");
    if (!quiet) setIsLoading(true);

    try {
      const response = await config.loader();
      const apiRecords = unwrapClientList(response).map((item) => normalizeClientRecord(item, config.key));
      const foundApiRecord = apiRecords.find((item) => item.id === id);

      // Never substitute sample hosting/domain/order/invoice data for a missing
      // live record. A missing API object is not proof of customer ownership.
      setRecord(foundApiRecord ?? null);
      if (!foundApiRecord) setError("We could not find this item in your account.");
    } catch {
      setRecord(null);
      setError("We couldn’t load these details right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useAutoSync(loadRecord, `${resource}:${id}`);

  const actions = record ? getDetailActions(resource, record) : [];

  return (
    <DashboardShell
      role="client"
      title={record?.title ?? config.title}
      description={config.description}
      actions={
        <Button href={`/${config.key === "support" ? "client/support" : `client/${config.key}`}`} variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      }
    >
      <DashboardPage
        eyebrow={config.eyebrow}
        title={record?.title ?? config.title}
        description={record?.subtitle ?? config.description}
      >
        {isLoading ? (
          <div role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Opening your details…</div>
        ) : !record ? (
          <ErrorState title="Record unavailable" description={error || "The authorized API did not return this record."} />
        ) : (
          <div className="space-y-5">
            <Card className="overflow-hidden p-0">
              <div className="bg-[#0064E0] p-6 text-white sm:p-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] bg-white/15 text-white">
                      <Icon className="h-7 w-7" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm text-white/75">{record.id}</p>
                      <h2 className="mt-2 text-3xl font-medium tracking-[-0.05em]">{record.title}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">{record.subtitle}</p>
                    </div>
                  </div>

                  <Badge className="bg-white text-[#0064E0] ring-white">
                    {formatStatus(record.status)}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Server className="h-4 w-4" />
                    Details
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-950">{record.meta}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <ShieldCheck className="h-4 w-4" />
                    Status
                  </div>
                  <div className="mt-2">
                    <Badge variant={getStatusTone(record.status)}>{formatStatus(record.status)}</Badge>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <CalendarDays className="h-4 w-4" />
                    Date
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-950">{record.date || "—"}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <ExternalLink className="h-4 w-4" />
                    Amount
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-950">{record.amount || "—"}</p>
                </div>
              </div>
            </Card>

            <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
              <Card>
                <h3 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Activity timeline</h3>
                <div className="mt-5 space-y-4">
                  <p className="text-sm leading-6 text-slate-600">
                    The verified activity event feed is not connected to this detail view.
                    No synthetic payment, provisioning, DNS or hosting activity is displayed.
                  </p>
                </div>
              </Card>

              <Card>
                <h3 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Quick actions</h3>
                <div className="mt-5 grid gap-3">
                  {actions.map((action) => (
                    <Button key={action.label} href={action.href} variant={action.variant} className="w-full">
                      {action.label}
                    </Button>
                  ))}
                </div>
              </Card>
            </div>

          </div>
        )}
      </DashboardPage>
    </DashboardShell>
  );
}