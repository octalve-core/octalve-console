"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { api } from "@/lib/api/client";
import { apiPaths } from "@/lib/api/endpoints";
import { toAdminOperationPayload } from "@/lib/api/payload-mappers";
import { supportApi } from "@/lib/api/modules/support.api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";

type AdminOperationEditorViewProps = {
  operation: "support" | "knowledge-base" | "notifications";
};

const editorCopy: Record<AdminOperationEditorViewProps["operation"], {
  title: string;
  description: string;
  listHref: string;
  fields: Array<{ name: string; label: string; type: "text" | "textarea"; placeholder: string; required?: boolean }>;
}> = {
  support: {
    title: "Create support ticket",
    description: "Create a support record for customer issues, billing concerns, provisioning, DNS or hosting problems.",
    listHref: "/admin/support",
    fields: [
      { name: "subject", label: "Subject", type: "text", placeholder: "DNS setup issue", required: true },
      { name: "department", label: "Department", type: "text", placeholder: "Technical Support", required: true },
      { name: "priority", label: "Priority", type: "text", placeholder: "Normal", required: false },
      { name: "message", label: "Message", type: "textarea", placeholder: "Describe the issue...", required: true },
    ],
  },
  "knowledge-base": {
    title: "Create knowledge base article",
    description: "Create a help article for clients or internal support staff.",
    listHref: "/admin/knowledge-base",
    fields: [
      { name: "title", label: "Title", type: "text", placeholder: "How to point a domain", required: true },
      { name: "category", label: "Category", type: "text", placeholder: "Domains", required: true },
      { name: "excerpt", label: "Excerpt", type: "textarea", placeholder: "Short summary...", required: true },
      { name: "content", label: "Content", type: "textarea", placeholder: "Full article content...", required: false },
    ],
  },
  notifications: {
    title: "Create notification template",
    description: "Create an email or system notification template for auth, invoices, tickets, or services.",
    listHref: "/admin/settings/notifications",
    fields: [
      { name: "name", label: "Template name", type: "text", placeholder: "Invoice created", required: true },
      { name: "event", label: "Event", type: "text", placeholder: "invoice.created", required: true },
      { name: "subject", label: "Subject", type: "text", placeholder: "Your invoice is ready", required: true },
      { name: "body", label: "Body", type: "textarea", placeholder: "Template body...", required: true },
    ],
  },
};

function buildInitialState(operation: AdminOperationEditorViewProps["operation"]) {
  return editorCopy[operation].fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.name] = "";
    return acc;
  }, {});
}

export function AdminOperationEditorView({ operation }: AdminOperationEditorViewProps) {
  const copy = editorCopy[operation];

  const [values, setValues] = useState<Record<string, string>>(() => buildInitialState(operation));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function saveRecord(payload: Record<string, string>) {
    const apiPayload = toAdminOperationPayload(operation, payload);

    if (operation === "support") {
      return supportApi.createTicket(apiPayload);
    }

    if (operation === "knowledge-base") {
      return api.post(apiPaths.admin.knowledgeBase, apiPayload);
    }

    return api.post(apiPaths.admin.notificationTemplates, apiPayload);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    setIsSubmitting(true);

    try {
      await saveRecord(values);
      setNotice("Saved successfully. The backend accepted the serializer-aligned payload.");
    } catch {
      setError("The backend endpoint is not available yet or rejected the current payload. Check the serializer field names for this operation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DashboardShell
      role="admin"
      title={copy.title}
      description={copy.description}
      actions={
        <Button href={copy.listHref} variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      }
    >
      <DashboardPage eyebrow="Create" title={copy.title} description={copy.description}>
        <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-5 md:grid-cols-2">
                {copy.fields.map((field) => {
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

                  return (
                    <Input
                      key={field.name}
                      label={field.label}
                      name={field.name}
                      value={values[field.name] ?? ""}
                      required={field.required}
                      placeholder={field.placeholder}
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

              {error ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  {error}
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
            <h3 className="text-lg font-medium tracking-[-0.03em] text-slate-950">Serializer-aligned editor</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This editor now passes through a mapper before reaching the Django API, so UI names and serializer names stay separated.
            </p>
          </Card>
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}