"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { adminWorkspaceConfig, type AdminWorkspaceKey } from "../data/admin-workspace-config";

type AdminWorkspaceEditorViewProps = {
  workspace: AdminWorkspaceKey;
};

export function AdminWorkspaceEditorView({ workspace }: AdminWorkspaceEditorViewProps) {
  const config = adminWorkspaceConfig[workspace];
  const Icon = config.icon;

  const [values, setValues] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [recordId, setRecordId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryMode = searchParams.get("mode");
    const queryId = searchParams.get("id") ?? "";

    setMode(queryMode === "edit" ? "edit" : "create");
    setRecordId(queryId);

    const initialValues = (config.editorFields ?? []).reduce<Record<string, string>>((acc, field) => {
      acc[field.name] = field.name === "status" ? field.options?.[0] ?? "Active" : "";
      return acc;
    }, {});

    if (queryMode === "edit" && queryId) {
      const record = config.fallback.find((item) => item.id === queryId) ?? config.fallback[0];

      if (record) {
        initialValues.name = record.title;
        initialValues.title = record.title;
        initialValues.client = record.subtitle;
        initialValues.customer = record.subtitle;
        initialValues.status = record.status;
      }
    }

    setValues(initialValues);
  }, [config.editorFields, config.fallback]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setNotice(
        mode === "edit"
          ? "Record updated in the UI layer. Connect final backend endpoint when schema is ready."
          : "Record created in the UI layer. Connect final backend endpoint when schema is ready.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DashboardShell
      role="admin"
      title={mode === "edit" ? `Edit ${config.title}` : config.createLabel ?? `Create ${config.title}`}
      description={config.description}
      actions={
        <Button href={config.listHref} variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      }
    >
      <DashboardPage
        eyebrow={config.eyebrow}
        title={mode === "edit" ? `Edit ${config.title}` : config.createLabel ?? `Create ${config.title}`}
        description={config.description}
      >
        <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-5 md:grid-cols-2">
                {(config.editorFields ?? []).map((field) => {
                  if (field.type === "textarea") {
                    return (
                      <div key={field.name} className="space-y-2 md:col-span-2">
                        <label htmlFor={field.name} className="block text-sm font-medium text-slate-700">
                          {field.label}
                        </label>
                        <textarea
                          id={field.name}
                          value={values[field.name] ?? ""}
                          required={field.required}
                          placeholder={field.placeholder}
                          onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                          className="min-h-36 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#0064E0] focus:ring-4 focus:ring-[#0064E0]/10"
                        />
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
                          value={values[field.name] ?? ""}
                          required={field.required}
                          onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-[#0064E0] focus:ring-4 focus:ring-[#0064E0]/10"
                        >
                          {(field.options ?? []).map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  return (
                    <Input
                      key={field.name}
                      label={field.label}
                      name={field.name}
                      type={field.type}
                      placeholder={field.placeholder}
                      required={field.required}
                      value={values[field.name] ?? ""}
                      onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                    />
                  );
                })}
              </div>

              {notice ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                  {notice}
                </div>
              ) : null}

              <div className="flex justify-end border-t border-slate-200 pt-5">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
              <Icon className="h-6 w-6" />
            </div>

            <h3 className="mt-5 text-lg font-medium tracking-[-0.03em] text-slate-950">Workspace editor</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This editor keeps the route modern and API-ready while the backend finalizes the exact endpoint payload.
            </p>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">
              <p><span className="font-medium text-slate-700">Workspace:</span> {workspace}</p>
              <p><span className="font-medium text-slate-700">Mode:</span> {mode}</p>
              <p><span className="font-medium text-slate-700">Record:</span> {recordId || "New record"}</p>
            </div>
          </Card>
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}