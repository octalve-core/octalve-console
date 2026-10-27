"use client";
import { unwrapAdminList } from "../../utils/admin-record-normalizer";

import {useState} from "react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { useAutoSync } from "@/lib/hooks/useAutoSync";
import { DashboardShell } from "@/components/layout/DashboardShell";
import {Panel} from "@/components/design-system/Panel";
import {AdminGenericDirectory} from "../../components/AdminGenericDirectory";
import {AdminWorkspaceConnectionStatus} from "../components/AdminWorkspaceConnectionStatus";
import {ErrorState} from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { adminWorkspaceConfig, type AdminWorkspaceKey, type AdminWorkspaceRecord } from "../data/admin-workspace-config";

type AdminWorkspaceViewProps = {
  workspace: AdminWorkspaceKey;
};

function readString(item: Record<string, unknown>, keys: string[], fallback = "—") {
  for (const key of keys) {
    const value = item[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }

  return fallback;
}

function normalizeRecord(item: unknown, config: typeof adminWorkspaceConfig[AdminWorkspaceKey]): AdminWorkspaceRecord {
  const record = item as Record<string, unknown>;

  const id = readString(record, ["id", "uuid", "reference", "code"], "");
  if (!id) throw new Error("A record is missing its unique identifier.");
  const title = readString(record, ["quote_number", "full_name", "name", "title", "domain", "label", "subject", "client", "customer"], id);
  const subtitle = readString(record, ["client_email", "email", "summary", "description", "product", "package", "type"], config.title);
  const meta = readString(record, ["status", "quote_number", "adapter", "gateway", "provider", "category", "cycle"], "—");
  const amount = readString(record, ["total", "price", "amount", "balance", "credited"], "");
  const status = readString(record, ["status", "state", "payment_status"], "Unknown");
  const date = readString(record, ["date", "created_at", "updated_at", "renews", "expiry"], "");

  return {
    id,
    title,
    subtitle,
    meta,
    amount,
    status,
    date,
    actionHref: `${config.listHref}/${encodeURIComponent(id)}`,
  };
}

export function AdminWorkspaceView({ workspace }: AdminWorkspaceViewProps) {
  const config = adminWorkspaceConfig[workspace];
  const Icon = config.icon;

  const [records, setRecords] = useState<AdminWorkspaceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecords(quiet = false) {
    if (config.availability && config.availability !== "api") {
      setRecords([]);
      setError("");
      setIsLoading(false);
      return;
    }
    setError("");
    if (!quiet) setIsLoading(true);

    try {
      const response = await config.loader();
      const apiRecords = unwrapAdminList(response).map((item) => normalizeRecord(item, config));

      setRecords(apiRecords);
    } catch {
      setRecords([]);
      setError("We couldn’t load your records. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useAutoSync(loadRecords, workspace);

  return <DashboardShell role="admin" title={config.title} description={config.description}>
    <DashboardPage eyebrow={config.eyebrow} title={config.title} description={config.description}
>
      <div className="space-y-5">
        <Panel padded={false} className="overflow-hidden">
          <div className="flex min-w-0 items-start gap-4 bg-console-primary p-5 text-white sm:p-7">
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Icon className="h-6 w-6"/>
            </span>
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-semibold">{config.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/85">{config.description}</p>
            </div>
          </div>
        </Panel>
        {config.availability && config.availability !== "api" ?
         <AdminWorkspaceConnectionStatus workspace={workspace} title={config.title}/>:
         isLoading?<LoadingState title={"Loading "+config.title.toLowerCase()} description="Updating records…"/>:
         error?<ErrorState description={error}/>:
         <AdminGenericDirectory label={config.title} records={records}
          allowDetails={["billing-services","transactions","quotes","staff"].includes(workspace)}
          emptyTitle={config.emptyTitle} emptyDescription={config.emptyDescription}/>}
      </div>
    </DashboardPage>
  </DashboardShell>;
}