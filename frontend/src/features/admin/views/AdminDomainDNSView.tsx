"use client";

import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect,useState,type FormEvent} from "react";
import {ArrowLeft,ShieldCheck,Globe2} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {api} from "@/lib/api/client";
import type {LiveDomainDNS} from "@/lib/api/endpoints";
import {CloudRecordDirectory,type CloudRecord} from "@/components/data/CloudRecordDirectory";
import {readConnectionOverview,type DraftConnection} from "@/features/admin/integrations/connection-readback";

type DomainRecord={id:number;domain_name:string;status:string};
type Access={state:string;domain:string;read_only:true;execution_enabled:false};

export function AdminDomainDNSView(){
  const params=useParams<{id:string}>();
  const id=String(params.id||"");
  const [domain,setDomain]=useState<DomainRecord|null>(null);
  const [access,setAccess]=useState<Access|null>(null);
  const [live,setLive]=useState<LiveDomainDNS|null>(null);
  const [liveError,setLiveError]=useState(false);
  const [connections,setConnections]=useState<DraftConnection[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [failure,setFailure]=useState(false);
  const url=`/domains/domains/${encodeURIComponent(id)}/`;
  async function refresh(){
    const [detail,permission,overview]=await Promise.all([
      api.get<DomainRecord>(url),api.get<Access>(url+"dns-access/"),
      readConnectionOverview()
    ]);
    if(String(detail.id)!==id||permission.domain!==detail.domain_name||
       permission.read_only!==true||permission.execution_enabled!==false)
      throw Error("Domain authorization could not be verified.");
    setDomain(detail);setAccess(permission);
    setLive(null);setLiveError(false);
    if(permission.state==="connected"){
      try{
        const result=await api.get<LiveDomainDNS>(url+"live-dns/");
        if(result.state!=="connected"||result.domain!==detail.domain_name||
           result.read_only!==true||result.execution_enabled!==false||
           !Array.isArray(result.records)||result.records.length!==result.record_count||
           typeof result.checked_at!=="string")throw Error("Provider snapshot invalid");
        setLive(result);
      }catch{setLive(null);setLiveError(true);}
    }
    setConnections(overview.connections.filter(c=>
      c.adapter_key==="cloudflare-dns"&&c.state==="draft"&&c.environment==="live"));
  }
  useEffect(()=>{
    let active=true;
    if(!/^[1-9][0-9]{0,11}$/.test(id)){setLoading(false);return;}
    void refresh().catch(()=>{if(active){setFailure(true);setMessage("Domain access is unavailable.");}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[id]);
  async function submit(event:FormEvent<HTMLFormElement>,action:"prepare"|"approve"){
    event.preventDefault();
    if(busy)return;
    const form=event.currentTarget,fields=new FormData(form);
    const body=action==="prepare"?{
      connection_id:String(fields.get("connection_id")||""),
      authorization_reference:String(fields.get("authorization_reference")||"").trim(),
      confirm_password:String(fields.get("password")||""),
      totp_code:String(fields.get("totp")||""),
    }:{
      confirm_password:String(fields.get("password")||""),
      totp_code:String(fields.get("totp")||""),
    };
    form.reset();setBusy(true);setMessage("");setFailure(false);
    try{
      await api.post(url+(action==="prepare"?"dns-prepare/":"dns-approve/"),body);
      await refresh();
      setMessage(action==="prepare"?
        "Connection prepared. The customer can now approve read-only access in My Domains.":
        "Read-only DNS access approved. The customer can now see live records.");
    }catch{setFailure(true);setMessage("Could not confirm DNS access. Check the exact domain, saved connection, customer approval and your account verification.");}
    finally{setBusy(false);}
  }
  const state=access?.state;
  return <DashboardShell role="admin" title="Domain DNS access"
    description="Approve verified customer access to Cloudflare DNS records.">
    <DashboardPage eyebrow="Domain services" title={domain?.domain_name||"DNS access"}
      description="Securely connect and approve read-only DNS visibility. No records can be changed.">
      <div className="space-y-5">
        <Link href={`/admin/billing/domains/${encodeURIComponent(id)}`}
          className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-console-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true"/>Back to domain
        </Link>
        {loading?<Panel><p className="text-sm text-console-muted">Checking domain access…</p></Panel>:null}
        {message?<Panel><p role={failure?"alert":"status"} className="text-sm text-console-ink">{message}</p></Panel>:null}
        {domain&&access?<Panel>
          <div className="flex items-center gap-3">
            <Globe2 className="h-5 w-5 text-console-primary" aria-hidden="true"/>
            <h2 className="text-base font-medium text-console-ink">Customer DNS connection</h2>
          </div>
          <p className="mt-3 text-sm text-console-muted">Current access: {state?.replaceAll("_"," ")}.
            Cloudflare records are visible to the customer only after explicit consent and final approval.</p>
        </Panel>:null}
        {domain&&access&&["not_connected","revoked"].includes(state||"")?<Panel>
          <h2 className="flex items-center gap-2 text-base font-medium text-console-ink">
            <ShieldCheck className="h-5 w-5 text-console-primary"/>Prepare Cloudflare access</h2>
          <p className="mt-2 text-sm text-console-muted">
            Choose the existing live connection for this exact domain.
            Record the reference of your verified customer-authorization evidence.
            The customer must approve access separately before you can activate it.
          </p>
          {connections.length?<form autoComplete="off" onSubmit={e=>void submit(e,"prepare")}
            className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-console-ink">Approved Cloudflare account
              <select name="connection_id" required defaultValue=""
                className="mt-2 min-h-11 w-full rounded-lg border border-console-line bg-white px-3">
                <option value="" disabled>Choose an account</option>
                {connections.map(c=><option key={c.id} value={c.id}>{c.label} · {c.verification_status.replaceAll("_"," ")}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-console-ink">
              Customer-authorization reference
              <input name="authorization_reference" required minLength={16} maxLength={160}
                placeholder="Approved customer consent or support reference"
                className="mt-2 min-h-11 w-full rounded-lg border border-console-line px-3"/>
            </label>
            <SecurityConfirmation/>
            <button disabled={busy} type="submit"
              className="min-h-11 rounded-xl bg-console-primary px-4 text-sm font-medium text-white disabled:opacity-50">
              {busy?"Checking…":"Verify zone and prepare access"}
            </button>
          </form>:<p className="mt-3 text-sm text-console-muted">
            No live Cloudflare DNS connections are available in the Integration Store.
          </p>}
        </Panel>:null}
        {domain&&access&&state==="awaiting_customer_approval"?<Panel>
          <h2 className="text-base font-medium">Awaiting customer confirmation</h2>
          <p className="mt-2 text-sm text-console-muted">
            Ask the domain owner to open My Domains → DNS records and approve read-only access.
          </p>
          <button type="button" className="mt-3 min-h-10 rounded-lg border border-console-line px-3 text-sm"
            onClick={()=>void refresh().catch(()=>{setFailure(true);setMessage("Access status is temporarily unavailable.");})}>
            Check approval status
          </button>
        </Panel>:null}
        {domain&&access&&state==="awaiting_octalve_approval"?<Panel>
          <h2 className="text-base font-medium">Complete customer DNS authorization</h2>
          <p className="mt-2 text-sm text-console-muted">
            The customer has approved access. Confirm the Cloudflare zone again,
            then activate the read-only view.
          </p>
          <form autoComplete="off" onSubmit={e=>void submit(e,"approve")}
            className="mt-4 space-y-4">
            <SecurityConfirmation/>
            <button type="submit" disabled={busy}
              className="min-h-11 rounded-xl bg-console-primary px-4 text-sm font-medium text-white disabled:opacity-50">
              {busy?"Verifying…":"Approve read-only DNS access"}
            </button>
          </form>
        </Panel>:null}
        {domain&&access&&state==="connected"?<>
          <Panel>
            <h2 className="text-base font-medium">Read-only access approved</h2>
            <p className="mt-2 text-sm text-console-muted">
              The domain owner may view the provider's current records. DNS changes,
              nameserver changes and purchases remain disabled.
            </p>
            {liveError?<p role="alert" className="mt-3 text-sm text-rose-700">
              Cloudflare records are temporarily unavailable. No stored records are displayed
              as live data.</p>:null}
            {live?.checked_at?<p className="mt-3 text-xs text-console-muted">
              Provider inventory checked {new Date(live.checked_at).toLocaleString("en-NG")}.
              {" "}Cloudflare zone nameservers do not independently establish public delegation.
            </p>:null}
          </Panel>
          {live&&!liveError?<CloudRecordDirectory label="Live DNS records"
            records={live.records.map((rec):CloudRecord=>({
              id:rec.id,title:rec.name,subtitle:rec.value,reference:rec.type,
              amount:rec.ttl===1?"Auto":rec.ttl+"s",status:"active",
              category:rec.proxied===true?"Proxied":rec.proxied===false?"DNS only":"Not applicable",
              details:{Type:rec.type,Value:rec.value,TTL:rec.ttl===1?"Auto":rec.ttl+"s"},
            }))}
            emptyMessage="Cloudflare returned no records for this zone."
            columns={[
              {key:"name",label:"Host",render:r=><span className="break-all font-medium">{r.title}</span>},
              {key:"type",label:"Type",render:r=>r.reference||"—"},
              {key:"value",label:"Value",render:r=><span className="break-all">{r.subtitle||"—"}</span>},
              {key:"ttl",label:"TTL",render:r=>r.amount||"—"},
              {key:"proxy",label:"Proxy",render:r=>r.category||"Not applicable"},
            ]}/>:null}
        </>:null}
      </div>
    </DashboardPage>
  </DashboardShell>;
}
function SecurityConfirmation(){
  return <>
    <label className="block text-sm font-medium text-console-ink">Current Octalve account password
      <input name="password" type="password" autoComplete="off" required
        className="mt-2 min-h-11 w-full rounded-lg border border-console-line px-3"/>
    </label>
    <label className="block text-sm font-medium text-console-ink">Fresh six-digit authenticator code
      <input name="totp" type="text" inputMode="numeric" pattern="[0-9]{6}"
        maxLength={6} autoComplete="one-time-code" required
        className="mt-2 min-h-11 w-full rounded-lg border border-console-line px-3"/>
    </label>
  </>;
}
