"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { clientApi } from "@/lib/api/endpoints";

export function ClientSupportTicketEditorView() {
  const [values, setValues] = useState({
    subject: "",
    department: "Technical Support",
    priority: "Normal",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setError("");
    setIsSubmitting(true);

    try {
      await clientApi.createTicket({
        subject: values.subject.trim(),
        department: values.department.trim(),
        priority: values.priority.trim(),
        message: values.message.trim(),
      });

      setNotice("Ticket submitted successfully. Support will respond as soon as possible.");
      setValues({
        subject: "",
        department: "Technical Support",
        priority: "Normal",
        message: "",
      });
    } catch {
      setError("The support API is not available yet or rejected the payload. The UI is ready for integration.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DashboardShell
      role="client"
      title="Open support ticket"
      description="Create a ticket for hosting, billing, domain, DNS, email, or provisioning support."
      actions={
        <Button href="/client/support" variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      }
    >
      <DashboardPage
        eyebrow="Support"
        title="Open support ticket"
        description="Tell us what you need help with. Your request will be routed to the right support area."
      >
        <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-5 md:grid-cols-2">
                <Input
                  label="Subject"
                  name="subject"
                  placeholder="DNS setup issue"
                  value={values.subject}
                  onChange={(event) => setValues((current) => ({ ...current, subject: event.target.value }))}
                  required
                />

                <Input
                  label="Department"
                  name="department"
                  placeholder="Technical Support"
                  value={values.department}
                  onChange={(event) => setValues((current) => ({ ...current, department: event.target.value }))}
                  required
                />

                <div className="space-y-2">
                  <label htmlFor="priority" className="block text-sm font-medium text-slate-700">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={values.priority}
                    onChange={(event) => setValues((current) => ({ ...current, priority: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-[#0064E0] focus:ring-4 focus:ring-[#0064E0]/10"
                  >
                    <option>Low</option>
                    <option>Normal</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700">
                    Message
                  </label>
                  <textarea
                    id="message"
                    value={values.message}
                    onChange={(event) => setValues((current) => ({ ...current, message: event.target.value }))}
                    placeholder="Describe the issue clearly..."
                    required
                    className="min-h-40 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#0064E0] focus:ring-4 focus:ring-[#0064E0]/10"
                  />
                </div>
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
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit ticket
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0064E0]/10 text-[#0064E0]">
              <ShieldCheck className="h-6 w-6" />
            </div>

            <h3 className="mt-5 text-lg font-medium tracking-[-0.03em] text-slate-950">
              Support routing
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Tickets are designed to route to billing, technical support, domains, provisioning, and account teams.
            </p>
          </Card>
        </div>
      </DashboardPage>
    </DashboardShell>
  );
}