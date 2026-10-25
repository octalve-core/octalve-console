"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DashboardPage } from "@/components/layout/DashboardPage";

type Grant = { code: string; state: string; redirect_uri: string };

export function OPanelAuthorization() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const state = search.get("state") ?? "";
  const challenge = search.get("code_challenge") ?? "";
  const id = params.id;
  const valid = /^\d+$/.test(id) && /^[A-Za-z0-9_-]{22,128}$/.test(state) &&
    /^[A-Za-z0-9_-]{43,128}$/.test(challenge);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function approve() {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      // Authorization occurs under the customer's existing Console session.
      // The BFF never forwards a customer's cookie or JWT to OPanel.
      const grant = await api.post<Grant>("/integrations/opanel/v1/authorize/", {
        service_id: Number(id), state, code_challenge: challenge,
      });
      const redirect = new URL(grant.redirect_uri);
      if (redirect.protocol !== "https:" || redirect.username || redirect.password ||
          redirect.hash || redirect.search || grant.state !== state) {
        throw new Error("The approved panel callback is invalid.");
      }
      redirect.searchParams.set("code", grant.code);
      redirect.searchParams.set("state", state);
      window.location.replace(redirect.toString());
    } catch {
      setError("Secure OPanel access is unavailable. Confirm the service is active and provider-provisioned, then retry.");
      setBusy(false);
    }
  }

  return <DashboardShell role="client" title="Secure hosting access"
      description="Continue using your existing Octalve Console account.">
    <DashboardPage eyebrow="Octalve Cloud / OPanel SSO"
      title="Authorize hosting management"
      description="A separate OPanel session will be created only for the hosting service you own. No second password is required.">
      <section className="max-w-lg rounded-2xl border bg-white p-6 space-y-4">
        <p className="text-sm text-slate-700">Console will verify the service ownership, status and provider provisioning confirmation before allowing access.</p>
        {!valid && <p role="alert" className="text-sm text-red-700">This OPanel launch request is malformed. Start again from your Console hosting service.</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="button" disabled={!valid || busy} onClick={approve}
          className="rounded-lg bg-[#0064E0] px-5 py-3 text-white font-semibold disabled:opacity-50">
          {busy ? "Authorizing…" : "Continue to OPanel"}
        </button>
        <p><Link className="text-sm text-[#0064E0]" href={`/client/services/${encodeURIComponent(id)}`}>Return to Console service</Link></p>
      </section>
    </DashboardPage>
  </DashboardShell>;
}
