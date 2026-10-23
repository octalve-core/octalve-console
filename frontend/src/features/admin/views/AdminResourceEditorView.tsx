"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ApiFormError } from "@/components/feedback/ApiFormError";
import { FieldError } from "@/components/forms/FieldError";
import { cn } from "@/lib/utils";
import {
  getApiFieldError,
  parseApiValidationError,
  type ApiFieldErrors,
} from "@/lib/api/validation";
import { adminResourceConfig, type AdminResourceKey } from "../data/admin-resource-config";
import { adminEditorConfig, type AdminEditorField } from "../data/admin-editor-config";
import type { AdminRecord } from "../data/admin-demo-data";
import { saveAdminResourceRecord, type AdminSaveMode } from "../data/admin-resource-actions";
import { normalizeAdminRecord, unwrapAdminList } from "../utils/admin-record-normalizer";

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

function getInitialValue(field: AdminEditorField, record?: AdminRecord | null) {
  if (!record) {
    if (field.name === "status") return "Active";
    if (field.name === "currency") return "NGN";
    if (field.name === "priority") return "normal";
    return "";
  }

  const map: Record<string, string | undefined> = {
    id: record.id,
    name: record.title,
    title: record.title,
    domain: record.title,
    display_name: record.title,
    customer: record.title,
    client: record.title,
    email: record.subtitle.includes("@") ? record.subtitle : "",
    product: record.subtitle,
    category: record.meta,
    adapter: record.meta,
    adapter_type: record.meta,
    description: record.meta,
    summary: record.subtitle,
    total: record.amount?.replace(/[^\d.]/g, ""),
    price: record.amount?.replace(/[^\d.]/g, ""),
    amount: record.amount?.replace(/[^\d.]/g, ""),
    balance: record.amount?.replace(/[^\d.]/g, ""),
    date: "",
    dueDate: "",
    expiry: "",
    status: record.status,
  };

  return map[field.name] ?? "";
}

function buildInitialState(fields: AdminEditorField[], record?: AdminRecord | null) {
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

export function AdminResourceEditorView({ resource, mode = "create" }: AdminResourceEditorViewProps) {
  const router = useRouter();
  const params = useParams();

  const routeId = decodeURIComponent(getParamValue(params.id));
  const [queryState, setQueryState] = useState<QueryState>({
    mode: "",
    id: "",
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryMode = searchParams.get("mode");
    const queryId = searchParams.get("id") ?? "";

    setQueryState({
      mode: queryMode === "edit" ? "edit" : "",
      id: queryId,
    });
  }, []);

  const effectiveMode: AdminSaveMode = queryState.mode === "edit" ? "edit" : mode;
  const activeId = routeId || queryState.id;

  const listConfig = adminResourceConfig[resource];
  const editorConfig = adminEditorConfig[resource];

  const [sourceRecord, setSourceRecord] = useState<AdminRecord | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => buildInitialState(editorConfig.fields));
  const [isLoading, setIsLoading] = useState(effectiveMode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ApiFieldErrors>({});

  const pageTitle = effectiveMode === "edit" ? editorConfig.editTitle : editorConfig.createTitle;

  const editDescription = useMemo(() => {
    if (effectiveMode === "edit") {
      return `Update ${sourceRecord?.title ?? "this record"} while keeping the backend API contract intact.`;
    }

    return editorConfig.description;
  }, [editorConfig.description, effectiveMode, sourceRecord?.title]);

  useEffect(() => {
    let active = true;

    async function loadEditableRecord() {
      if (effectiveMode !== "edit") {
        setValues(buildInitialState(editorConfig.fields));
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
        const apiRecords = unwrapAdminList(response).map((item) => normalizeAdminRecord(item, listConfig.key));
        const foundApiRecord = apiRecords.find((item) => item.id === activeId);

        const fallbackRecord =
          foundApiRecord ??
          listConfig.fallback.find((item) => item.id === activeId || item.title === activeId) ??
          listConfig.fallback[0] ??
          null;

        if (!active) return;

        setSourceRecord(fallbackRecord);
        setValues(buildInitialState(editorConfig.fields, fallbackRecord));

        if (!foundApiRecord) {
          if (fallbackRecord) {
            setNotice("Development fallback record loaded.");
          } else {
            setError("The requested record does not exist in the live API.");
          }
        }
      } catch {
        const fallbackRecord =
          listConfig.fallback.find((item) => item.id === activeId || item.title === activeId) ??
          listConfig.fallback[0] ??
          null;

        if (!active) return;

        setSourceRecord(fallbackRecord);
        setValues(buildInitialState(editorConfig.fields, fallbackRecord));
        if (fallbackRecord) {
          setNotice("Development fallback record loaded.");
        } else {
          setError("Could not load this record from the live API. Editing is unavailable.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadEditableRecord();

    return () => {
      active = false;
    };
  }, [activeId, effectiveMode, editorConfig.fields, listConfig]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (effectiveMode === "edit" && !sourceRecord) {
      setError("A verified record must be loaded before it can be edited.");
      return;
    }
    setError("");
    setNotice("");
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload = buildPayload(values);

      await saveAdminResourceRecord(resource, effectiveMode, payload, activeId || sourceRecord?.id);

      setNotice("Saved successfully. The backend accepted the submitted payload.");

      setTimeout(() => {
        router.push(editorConfig.listHref);
      }, 900);
    } catch (err) {
      const parsedError = parseApiValidationError(
        err,
        "The API could not save this record yet. Check the backend endpoint or schema mapping.",
      );

      setError(parsedError.message);
      setFieldErrors(parsedError.fieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateField(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));

    if (fieldErrors[name]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[name];
        return next;
      });
    }
  }

  function renderField(field: AdminEditorField) {
    const value = values[field.name] ?? "";
    const fieldError = getApiFieldError(fieldErrors, field.name);

    if (field.type === "textarea") {
      return (
        <div key={field.name} className="space-y-2">
          <label htmlFor={field.name} className="block text-sm font-medium text-slate-700">
            {field.label}
          </label>
          <textarea
            id={field.name}
            name={field.name}
            value={value}
            required={field.required}
            placeholder={field.placeholder}
            aria-invalid={Boolean(fieldError)}
            onChange={(event) => updateField(field.name, event.target.value)}
            className={cn(
              "min-h-32 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4",
              fieldError
                ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                : "border-slate-200 focus:border-[#0064E0] focus:ring-[#0064E0]/10",
            )}
          />
          <FieldError message={fieldError} />
        </div>
      );
    }

    if (field.type === "select") {
      return (
        <div key={field.name} className="space-y-2">
          <label htmlFor={field.name} className="block text-sm font-medium text-slate-700">
            {field.label}
          </label>
          <select
            id={field.name}
            name={field.name}
            value={value}
            required={field.required}
            aria-invalid={Boolean(fieldError)}
            onChange={(event) => updateField(field.name, event.target.value)}
            className={cn(
              "h-12 w-full rounded-2xl border bg-white px-4 text-sm text-slate-950 outline-none transition focus:ring-4",
              fieldError
                ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                : "border-slate-200 focus:border-[#0064E0] focus:ring-[#0064E0]/10",
            )}
          >
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldError message={fieldError} />
        </div>
      );
    }

    return (
      <div key={field.name}>
        <Input
          label={field.label}
          id={field.name}
          name={field.name}
          type={field.type}
          placeholder={field.placeholder}
          required={field.required}
          value={value}
          aria-invalid={Boolean(fieldError)}
          onChange={(event) => updateField(field.name, event.target.value)}
        />
        <FieldError message={fieldError} />
      </div>
    );
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
        {isLoading ? (
          <LoadingState title="Preparing editor" description="Loading record details for editing." />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
            <Card>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-5 md:grid-cols-2">
                  {editorConfig.fields.map(renderField)}
                </div>

                {notice ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                    {notice}
                  </div>
                ) : null}

                <ApiFormError message={error} fieldErrors={fieldErrors} />

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                  <Button href={editorConfig.listHref} variant="outline">
                    Cancel
                  </Button>

                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save record
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Card>

            <div className="space-y-5">
              <Card>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
                  <ShieldCheck className="h-6 w-6" />
                </div>

                <h3 className="mt-5 text-lg font-medium tracking-[-0.03em] text-slate-950">
                  Field validation ready
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Django serializer errors now appear under each matching field, while general API errors remain visible above the form actions.
                </p>

                <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">
                  <p>
                    <span className="font-medium text-slate-700">Resource:</span> {resource}
                  </p>
                  <p>
                    <span className="font-medium text-slate-700">Mode:</span> {effectiveMode}
                  </p>
                  <p className={cn(!activeId && effectiveMode === "edit" && "text-red-600")}>
                    <span className="font-medium text-slate-700">Record ID:</span>{" "}
                    {activeId || sourceRecord?.id || "New record"}
                  </p>
                </div>
              </Card>

              <Card>
                <h3 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Navigation</h3>
                <div className="mt-4 grid gap-3">
                  <Link href={editorConfig.listHref} className="rounded-2xl border border-slate-200 p-4 text-sm font-medium text-slate-700 transition hover:border-[#0064E0]/30 hover:bg-slate-50">
                    View all {listConfig.title.toLowerCase()}
                  </Link>

                  {editorConfig.newHref ? (
                    <Link href={editorConfig.newHref} className="rounded-2xl border border-slate-200 p-4 text-sm font-medium text-slate-700 transition hover:border-[#0064E0]/30 hover:bg-slate-50">
                      Create another record
                    </Link>
                  ) : null}
                </div>
              </Card>
            </div>
          </div>
        )}
      </DashboardPage>
    </DashboardShell>
  );
}