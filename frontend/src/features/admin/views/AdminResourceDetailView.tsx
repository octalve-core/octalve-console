"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {ArrowLeft,RefreshCcw} from "lucide-react";
import {AdminRecordDetailPanel} from "../components/AdminRecordDetailPanel";
import {ActionLink} from "@/components/design-system/ActionLink";
import {ActionButton} from "@/components/design-system/ActionButton";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { adminResourceConfig, type AdminResourceKey } from "../data/admin-resource-config";
import { adminEditorConfig } from "../data/admin-editor-config";
import type { AdminRecord } from "../data/admin-demo-data";
import { normalizeAdminRecord, unwrapAdminList } from "../utils/admin-record-normalizer";
import {isAdminMutationDisabled} from "../data/admin-action-policy";

type AdminResourceDetailViewProps = {
  resource: AdminResourceKey;
};

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function AdminResourceDetailView({ resource }: AdminResourceDetailViewProps) {
  const params = useParams();
  const id = decodeURIComponent(getParamValue(params.id));

  const listConfig = adminResourceConfig[resource];
  const editorConfig = adminEditorConfig[resource];

  const [record, setRecord] = useState<AdminRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  async function loadRecord() {
    setIsLoading(true);
    setError("");

    try {
      const response = await listConfig.loader();
      const apiRecords = unwrapAdminList(response).map((item) => normalizeAdminRecord(item, listConfig.key));
      const foundApiRecord = apiRecords.find((item) => item.id === id);

      setRecord(foundApiRecord ?? null);
      if (!foundApiRecord) setError("This record was not found in the authorized response.");
    } catch {
      setRecord(null);
      setError("We couldn’t load this record. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, id]);

  const editHref = useMemo(() => {
    return `${editorConfig.listHref}/new?mode=edit&id=${encodeURIComponent(id)}`;
  }, [editorConfig.listHref, id]);

  return (
    <DashboardShell
      role="admin"
      title={editorConfig.detailLabel}
      description={listConfig.description}
      actions={
        <ActionLink href={editorConfig.listHref} variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back
        </ActionLink>
      }
    >
      <DashboardPage
        eyebrow={listConfig.eyebrow}
        title={record?.title ?? editorConfig.detailLabel}
        description={record?.subtitle ?? listConfig.description}
        actions={
          <ActionButton type="button" variant="outline" onClick={loadRecord}
            leadingIcon={<RefreshCcw aria-hidden="true" className="h-4 w-4"/>}>Refresh</ActionButton>
        }
      >
        {isLoading ? (
          <LoadingState title="Loading record" description="Getting the latest details…" />
        ) : !record ? (
          <ErrorState title="Record unavailable" description={error || "This record could not be found."}/>
        ) : (
          <AdminRecordDetailPanel record={record}
            actions={[...(resource==="providers"?[]:isAdminMutationDisabled(resource)?[]:[{href:editHref,label:"Edit record",variant:"primary" as const}]),
              {href:editorConfig.listHref,label:"Back to records",variant:"outline"}]}/>
        )}
      </DashboardPage>
    </DashboardShell>
  );
}