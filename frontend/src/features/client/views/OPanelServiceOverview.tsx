"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { api } from "@/lib/api/client";

type Overview = {
  service_id: number; label:string; domain_name:string|null; service_type:string;
  status:string; active:boolean; usage_status:string; message:string;
  usage:{disk_used_mb:number; disk_limit_mb:number;bandwidth_used_mb:number;bandwidth_limit_mb:number;recorded_at:string}|null;
  capabilities:Record<string,boolean>;
};
const modules = ["files","subdomains","dns","databases","ssl","backups","email"] as const;
const names:Record<string,string> = {files:"File manager",subdomains:"Subdomains",dns:"DNS manager",
  databases:"Databases",ssl:"SSL certificates",backups:"Backups",email:"Email accounts",panel_sso:"Advanced panel"};

export function OPanelServiceOverview(){
  const params=useParams<{id:string}>();
  const [data,setData]=useState<Overview|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let current=true;
    api.get<Overview>(`/services/opanel/${encodeURIComponent(String(params.id))}/overview/`)
      .then(value=>{if(current)setData(value);})
      .catch(()=>{if(current)setError("OPanel service unavailable or access denied.");})
      .finally(()=>{if(current)setLoading(false);});
    return()=>{current=false;};
  },[params.id]);
  return <DashboardShell role="client" title="Hosting status" description="Read-only hosting information provided by Octalve Console.">
    <DashboardPage eyebrow="Octalve Cloud / Console" title={data?.label||"Your hosting service"}
      description="This is Console service status, not an OPanel sign-in. Full management will launch separately through secure Console SSO once qualified.">
      <div className="space-y-5">
        <Link href={`/client/services/${encodeURIComponent(String(params.id))}`} className="text-sm font-medium text-[#0064E0]">Back to Console service</Link>
        {loading&&<div role="status" className="rounded-xl bg-white p-6">Loading service status...</div>}
        {error&&<div role="alert" className="rounded-xl bg-red-50 p-6 text-red-700">{error}</div>}
        {data&&<>
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="text-lg font-semibold">{data.domain_name||"Domain not attached"}</h2>
            <p className="mt-2 text-sm">Service status: <strong>{data.status}</strong></p>
            {!data.active&&<p className="mt-2 text-sm text-amber-800">No confirmed active hosting account is available yet.</p>}
            <p className="mt-3 text-sm text-slate-600">{data.message}</p>
            {data.capabilities.panel_sso && /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?\/?$/.test(process.env.NEXT_PUBLIC_OPANEL_BASE_URL || "") && (
              <a className="mt-4 inline-flex rounded-lg bg-[#0064E0] px-4 py-3 font-medium text-white"
                href={`${(process.env.NEXT_PUBLIC_OPANEL_BASE_URL || "").replace(/\/$/, "")}/auth/start/?service_id=${encodeURIComponent(String(data.service_id))}`}>
                Manage hosting / Open OPanel
              </a>
            )}
          </section>
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-3 text-lg font-semibold">Recorded resource usage</h2>
            {data.usage?<div className="grid gap-4 md:grid-cols-2 text-sm">
              <p>Disk: <strong>{data.usage.disk_used_mb} / {data.usage.disk_limit_mb} MB</strong></p>
              <p>Bandwidth: <strong>{data.usage.bandwidth_used_mb} / {data.usage.bandwidth_limit_mb} MB</strong></p>
              <p className="text-xs text-slate-500 md:col-span-2">Last recorded: {new Date(data.usage.recorded_at).toLocaleString()}</p>
            </div>:<p className="text-sm text-slate-500">No verified provider usage snapshot has been recorded.</p>}
          </section>
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-3 text-lg font-semibold">Future OPanel management tools</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {modules.map(key=><div key={key} className="rounded-xl border p-4">
                <p className="font-medium text-sm">{names[key]}</p>
                <p className="mt-1 text-xs text-slate-500">{data.capabilities[key]?"Available":"Requires verified adapter"}</p>
              </div>)}
            </div>
          </section>
        </>}
      </div>
    </DashboardPage>
  </DashboardShell>;
}
