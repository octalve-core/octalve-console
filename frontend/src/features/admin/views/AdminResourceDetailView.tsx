"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {ArrowLeft} from "lucide-react";
import {AdminRecordDetailPanel} from "../components/AdminRecordDetailPanel";
import {ActionLink} from "@/components/design-system/ActionLink";
import {CustomerProfileDetail,type CustomerDetail} from "../components/CustomerProfileDetail";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { adminResourceConfig, type AdminResourceKey } from "../data/admin-resource-config";
import { adminEditorConfig } from "../data/admin-editor-config";
import type { AdminRecord } from "../data/admin-demo-data";
import { normalizeAdminRecord, unwrapAdminList } from "../utils/admin-record-normalizer";
import {adminApi} from "@/lib/api/endpoints";
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
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  async function loadRecord() {
    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setError("");

    try {
      const response = resource === "customers"
        ? await adminApi.customer(id)
        : await listConfig.loader();
      const apiRecords = resource === "customers"
        ? [normalizeAdminRecord(response, "customers")]
        : unwrapAdminList(response).map((item) => normalizeAdminRecord(item, listConfig.key));
      const foundApiRecord = apiRecords.find((item) => item.id === id);
      if (requestId !== requestSequence.current) return;
      setCustomer(resource==="customers"?response as unknown as CustomerDetail:null);
      setRecord(foundApiRecord ?? null);
      if (!foundApiRecord) setError(
        resource === "customers"
          ? "The customer record could not be verified."
          : "This record is not on the loaded page. Return to the directory."
      );
    } catch {
      if (requestId !== requestSequence.current) return;
      setRecord(null);setCustomer(null);
      setError("We couldn’t load this record. Try again.");
    } finally {
      if (requestId === requestSequence.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRecord();
    return () => {requestSequence.current += 1;};
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
    >
      <div className="mb-4"><ActionLink href={editorConfig.listHref} variant="outline">
       <ArrowLeft className="h-4 w-4" aria-hidden="true"/> Back to {resource==="customers"?"customers":"records"}
      </ActionLink></div>
      <DashboardPage
        eyebrow={listConfig.eyebrow}
        title={record?.title ?? editorConfig.detailLabel}
        description={record?.subtitle ?? listConfig.description}
      >
        {isLoading ? (
          <LoadingState title="Loading record" description="Getting the latest details…" />
        ) : !record ? (
          <ErrorState title="Record unavailable" description={error || "This record could not be found."}/>
        ) : resource==="customers"&&customer ? (
          <CustomerProfileDetail data={customer} record={record} editHref={editHref}/>
        ) : (
          <AdminRecordDetailPanel record={record}
            actions={[...(resource==="providers"?[]:isAdminMutationDisabled(resource)?[]:[{href:editHref,label:"Edit record",variant:"primary" as const}]),
              {href:editorConfig.listHref,label:"Back to records",variant:"outline"}]}/>
        )}
      </DashboardPage>
    </DashboardShell>
  );
}