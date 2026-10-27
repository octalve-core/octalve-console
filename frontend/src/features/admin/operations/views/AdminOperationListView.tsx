"use client";
import { unwrapAdminList } from "../../utils/admin-record-normalizer";

import {useState} from "react";
import {Plus} from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { useAutoSync } from "@/lib/hooks/useAutoSync";
import { DashboardShell } from "@/components/layout/DashboardShell";
import {ActionLink} from "@/components/design-system/ActionLink";
import {AdminGenericDirectory} from "../../components/AdminGenericDirectory";
import {ErrorState} from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { adminOperationConfig } from "../data/admin-operations-config";
import type { AdminOperationKey, AdminOperationRecord } from "../data/admin-operations-data";

type AdminOperationListViewProps = {
  operation: AdminOperationKey;
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

function normalizeRecord(item: unknown, operation: AdminOperationKey): AdminOperationRecord {
  const record = item as Record<string, unknown>;

  const id = readString(record, ["id", "uuid", "reference", "code"], "");
  if (!id) throw new Error("A record is missing its unique identifier.");
  const title = readString(record, ["title", "name", "subject", "template_name", "action", "event"], id);
  const subtitle = readString(record, ["description", "summary", "content", "department", "message", "email"], operation);
  const meta = readString(record, ["category", "type", "priority", "level", "status"], "—");
  const status = readString(record, ["status", "state", "level"], "Unknown");
  const date = readString(record, ["created_at", "updated_at", "date", "time"], "");

  const baseMap: Record<AdminOperationKey, string> = {
    support: "/admin/support",
    departments: "/admin/support/departments",
    responses: "/admin/support/responses",
    "knowledge-base": "/admin/knowledge-base",
    "audit-logs": "/admin/audit-logs",
    reports: "/admin/reports",
    notifications: "/admin/settings/notifications",
  };

  const detailable = operation === "support" || operation === "knowledge-base" || operation === "notifications";

  return {
    id,
    title,
    subtitle,
    meta,
    status,
    date,
    actionHref: detailable ? `${baseMap[operation]}/${encodeURIComponent(id)}` : baseMap[operation],
  };
}

export function AdminOperationListView({ operation }: AdminOperationListViewProps) {
  const config = adminOperationConfig[operation];

  const [records, setRecords] = useState<AdminOperationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadRecords(quiet = false) {
    setError("");
    if (!quiet) setIsLoading(true);

    try {
      const response = await config.loader();
      const apiRecords = unwrapAdminList(response).map((item) => normalizeRecord(item, config.key));

      setRecords(apiRecords);
    } catch {
      setRecords([]);
      setError("We couldn’t load your records. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useAutoSync(loadRecords, operation);

  return <DashboardShell role="admin" title={config.title} description={config.description}>
    <DashboardPage eyebrow={config.eyebrow} title={config.title} description={config.description}
      actions={config.createHref?<ActionLink href={config.createHref} className="w-full sm:w-auto">
        <Plus aria-hidden="true" className="h-4 w-4"/>{config.createLabel??"Create"}
      </ActionLink>:undefined}>
      {isLoading?<LoadingState title={"Loading "+config.title.toLowerCase()} description="Updating records…"/>:
       error?<ErrorState description={error}/>:
       <AdminGenericDirectory label={config.title} records={records}
        allowDetails={["support","knowledge-base","notifications"].includes(operation)}
        emptyTitle={config.emptyTitle} emptyDescription={config.emptyDescription}/>}
    </DashboardPage>
  </DashboardShell>;
}