"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {ArrowLeft} from "lucide-react";
import {AdminResourceEditorForm} from "../components/AdminResourceEditorForm";
import { Button } from "@/components/ui/Button";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorState } from "@/components/feedback/ErrorState";
import {
  parseApiValidationError,
  type ApiFieldErrors,
} from "@/lib/api/validation";
import { adminResourceConfig, type AdminResourceKey } from "../data/admin-resource-config";
import { adminEditorConfig, type AdminEditorField } from "../data/admin-editor-config";
import type { AdminRecord } from "../data/admin-demo-data";
import { saveAdminResourceRecord, type AdminSaveMode } from "../data/admin-resource-actions";
import { findExactAdminRecord, normalizeAdminRecord, unwrapAdminList } from "../utils/admin-record-normalizer";
import {isAdminMutationDisabled} from "../data/admin-action-policy";
import {AdminRestrictedActionView} from "./AdminRestrictedActionView";

type AdminResourceEditorViewProps = {
  resource: AdminResourceKey;
  mode?: AdminSaveMode;
};

type QueryState = {
  mode: AdminSaveMode | "";
  id: string;
};

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * Prefill only the exact field returned by Django, never a synthesized display
 * title, status, amount or category. Secrets are always write-only.
 */
function getInitialValue(field: AdminEditorField, record?: Record<string, unknown> | null) {
  if (!record) {
    if (field.name === "status") return field.options?.[0]?.value ?? "";
    if (field.name === "currency") return "NGN";
    if (field.name === "priority") return "normal";
    return "";
  }
  if (field.type === "password") return "";
  const key = field.name === "dueDate" ? "due_date" : field.name;
  const raw = key === "fulfillment_model" &&
    record.config && typeof record.config === "object" && !Array.isArray(record.config)
    ? (record.config as Record<string, unknown>).fulfillment_model
    : record[key];
  return (typeof raw === "string" || (typeof raw === "number" && Number.isFinite(raw)))
    ? String(raw)
    : "";
}

function buildInitialState(fields: AdminEditorField[], record?: Record<string, unknown> | null) {
  return fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.name] = getInitialValue(field, record);
    return acc;
  }, {});
}

function buildPayload(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value !== ""),
  );
}

function AuthorizedAdminResourceEditorView({ resource, mode = "create" }: AdminResourceEditorViewProps) {
  const router = useRouter();
  const params = useParams();

  const routeId = decodeURIComponent(getParamValue(params.id));
  const [queryState, setQueryState] = useState<QueryState | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryMode = searchParams.get("mode");
    const queryId = searchParams.get("id") ?? "";

    setQueryState({
      mode: queryMode === "edit" ? "edit" : "",
      id: queryId,
    });
  }, []);

  const effectiveMode: AdminSaveMode = queryState?.mode === "edit" ? "edit" : mode;
  const activeId = routeId || queryState?.id || "";

  const listConfig = adminResourceConfig[resource];
  const editorConfig = adminEditorConfig[resource];

  const [sourceRecord, setSourceRecord] = useState<AdminRecord | null>(null);
  const [touchedFields, setTouchedFields] = useState<string[]>([]);
  const [values, setValues] = useState<Record<string, string>>(() => buildInitialState(editorConfig.fields));
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});

  const pageTitle = effectiveMode === "edit" ? editorConfig.editTitle : editorConfig.createTitle;

  const editDescription = useMemo(() => {
    if (effectiveMode === "edit") {
      return `Update ${sourceRecord?.title ?? "this record"} using the latest available details.`;
    }

    return editorConfig.description;
  }, [editorConfig.description, effectiveMode, sourceRecord?.title]);

  useEffect(() => {
    let active = true;

    async function loadEditableRecord() {
      if (queryState === null) return;
      setSourceRecord(null);
      setTouchedFields([]);
      if (effectiveMode !== "edit") {
        setValues(buildInitialState(editorConfig.fields));
        setError("");
        setIsLoading(false);
        return;
      }

      if (!activeId) {
        setIsLoading(false);
        setError("Missing record ID for edit mode.");
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await listConfig.loader();
        const authorizedRows = unwrapAdminList(response);
        const exactRecord = findExactAdminRecord(authorizedRows, activeId);
        const foundApiRecord = exactRecord ? normalizeAdminRecord(exactRecord, listConfig.key) : null;

        if (!active) return;

        setSourceRecord(foundApiRecord);
        setValues(buildInitialState(editorConfig.fields, exactRecord));

        if (!foundApiRecord) {
          setError("This record is not available in your authorized account. Editing has been disabled.");
        }
      } catch {
        if (!active) return;

        setSourceRecord(null);
        setValues(buildInitialState(editorConfig.fields));
        setError("We could not verify this record with the server. Editing has been disabled.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadEditableRecord();

    return () => {
      active = false;
    };
  }, [activeId, effectiveMode, editorConfig.fields, listConfig, queryState]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || queryState === null || isLoading) return;
    if (effectiveMode === "edit" && (!activeId || sourceRecord?.id !== activeId)) {
      setError("This record could not be verified. Return to the list and select a valid record.");
      return;
    }
    const submittedValues = effectiveMode === "edit"
      ? Object.fromEntries(Object.entries(values).filter(([key]) => touchedFields.includes(key)))
      : values;
    const payload = buildPayload(submittedValues);
    if (Object.keys(payload).length === 0) {
      setError("Make a change before saving.");
      return;
    }
    setError("");
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      // PATCH only explicitly changed fields; never replay hidden, inferred or stale values.
      await saveAdminResourceRecord(resource, effectiveMode, payload, activeId || sourceRecord?.id);
      router.push(editorConfig.listHref);
    } catch (err) {
      const parsedError = parseApiValidationError(
        err,
        "We couldn’t save this record. Please review the details and try again.",
      );

      setError(parsedError.message);
      setFieldErrors(parsedError.fieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setTouchedFields((current) => current.includes(name) ? current : [...current, name]);

    if (fieldErrors[name]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[name];
        return next;
      });
    }
  }


  return (
    <DashboardShell
      role="admin"
      title={pageTitle}
      description={editDescription}
      actions={
        <Button href={editorConfig.listHref} variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      }
    >
      <DashboardPage
        eyebrow={listConfig.eyebrow}
        title={pageTitle}
        description={editDescription}
      >
        {(queryState === null || isLoading) ? (
          <LoadingState title="Preparing editor" description="Loading record details for editing." />
        ) : effectiveMode === "edit" && (!sourceRecord || sourceRecord.id !== activeId) ? (
          <ErrorState title="Record unavailable" description={error || "The requested record could not be verified."} />
        ) : (
          <div className="mx-auto w-full max-w-4xl">
            <AdminResourceEditorForm fields={editorConfig.fields} values={values}
              fieldErrors={fieldErrors} error={error} onChange={updateField}
              onSubmit={handleSubmit} isSubmitting={isSubmitting}
              backHref={editorConfig.listHref}/>
          </div>
        )}
      </DashboardPage>
    </DashboardShell>
  );
}
/** Never render an unqualified mutation form, including direct legacy URLs. */
export function AdminResourceEditorView(props:AdminResourceEditorViewProps){
 if(isAdminMutationDisabled(props.resource))return <AdminRestrictedActionView resource={props.resource}/>;
 return <AuthorizedAdminResourceEditorView {...props}/>;
}
