"use client";

import {useEffect,useState,type FormEvent} from "react";
import {Globe2,ShieldCheck,RefreshCw} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {adminApi,type ExternalDNSClaim} from "@/lib/api/endpoints";
import {readConnectionOverview,type DraftConnection} from "@/features/admin/integrations/connection-readback";

const pending = (claim:ExternalDNSClaim)=>claim.state==="pending"&&
  Date.parse(claim.expires_at)>Date.now();

export function AdminDNSClaimQueue(){
  const [claims,setClaims]=useState<ExternalDNSClaim[]>([]);
  const [connections,setConnections]=useState<DraftConnection[]>([]);
  const [available,setAvailable]=useState(false);
  const [selected,setSelected]=useState("");
  const [connectionId,setConnectionId]=useState("");
  const [busy,setBusy]=useState(false);
  const [issue,setIssue]=useState("");
  const [message,setMessage]=useState("");

  async function refresh(){
    const [claimsData,accounts]=await Promise.all([
      adminApi.externalDnsClaims(),readConnectionOverview()
    ]);
    if(claimsData.execution_enabled!==false||!Array.isArray(claimsData.results))
      throw Error("DNS claims unavailable.");
    setClaims(claimsData.results.slice(0,50));
    setConnections(accounts.connections.filter(row=>
      row.adapter_key==="cloudflare-dns"&&row.environment==="live"&&
      row.state==="draft"&&row.credential_configured));
    setAvailable(true);
  }
  useEffect(()=>{
    let active=true;
    void Promise.all([adminApi.externalDnsClaims(),readConnectionOverview()])
      .then(([data,accounts])=>{
        if(!active||data.execution_enabled!==false||!Array.isArray(data.results))return;
        setClaims(data.results.slice(0,50));
        setConnections(accounts.connections.filter(row=>
          row.adapter_key==="cloudflare-dns"&&row.environment==="live"&&
          row.state==="draft"&&row.credential_configured));
        setAvailable(true);
      }).catch(()=>{if(active)setAvailable(false);});
    return()=>{active=false;};
  },[]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!selected||!connectionId||busy)return;
    const form=event.currentTarget,fields=new FormData(form);
    setBusy(true);setIssue("");setMessage("");
    try{
      const result=await adminApi.verifyExternalDnsClaim({
        claim_id:selected,connection_id:connectionId,
        confirm_password:String(fields.get("password")||""),
        totp_code:String(fields.get("totp")||""),
      });
      form.reset();
      if(result.state!=="verified"||result.registration_confirmed!==false||
         result.execution_enabled!==false||!result.domain_id)
        throw Error("DNS verification receipt is incomplete.");
      setMessage("Cloudflare zone control verified. The customer must now approve read-only access.");
      setSelected("");setConnectionId("");
      await refresh();
    }catch{
      setIssue("Verification could not be confirmed. Check the exact zone, TXT challenge, saved connection and your fresh account verification.");
      form.reset();
    }finally{setBusy(false);}
  }

  const open=claims.filter(pending);
  return <Panel>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-blue-50 p-3 text-console-primary">
          <Globe2 className="h-5 w-5" aria-hidden="true"/>
        </span>
        <div>
          <h2 className="text-base font-medium text-console-ink">External domain DNS verification</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-console-muted">
            Confirm each customer's short-lived TXT proof against the exact saved
            Cloudflare zone. This does not register, renew or transfer a domain.
          </p>
        </div>
      </div>
      {available?<button type="button"
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-console-line px-3 text-sm font-medium"
        onClick={()=>void refresh().catch(()=>setIssue("Could not refresh DNS claims."))}>
        <RefreshCw className="h-4 w-4"/>Refresh
      </button>:null}
    </div>
    {!available?<p className="mt-4 text-sm text-console-muted">
      DNS-only onboarding is not available to this account or has not been activated.
    </p>:null}
    {available?<div className="mt-4 space-y-3">
      <p className="text-sm text-console-muted">
        {open.length?open.length+" pending requests in this view":
          "There are no unexpired claims awaiting verification."}
      </p>
      {open.length>0?<form autoComplete="off" onSubmit={e=>void submit(e)}
        className="space-y-4 rounded-xl border border-console-line bg-slate-50 p-4">
        <label className="block text-sm font-medium text-console-ink">
          Customer request
          <select required value={selected} onChange={e=>setSelected(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-console-line bg-white px-3">
            <option value="">Choose a pending claim</option>
            {open.map(row=><option key={row.id} value={row.id}>
              {row.domain_name} · Client #{row.client_id}
            </option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-console-ink">
          Exact approved Cloudflare zone connection
          <select required value={connectionId} onChange={e=>setConnectionId(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-console-line bg-white px-3">
            <option value="">Choose a scoped Cloudflare connection</option>
            {connections.map(row=><option key={row.id} value={row.id}>
              {row.label} · {row.verification_status.replaceAll("_"," ")}
            </option>)}
          </select>
        </label>
        <div className="flex items-center gap-2 text-xs text-console-muted">
          <ShieldCheck className="h-4 w-4"/>The API will recheck the zone and
          TXT value. Read-only provider access is required.
        </div>
        <label className="block text-sm font-medium text-console-ink">
          Current account password
          <input required type="password" name="password" autoComplete="off"
            className="mt-2 min-h-11 w-full rounded-lg border border-console-line bg-white px-3"/>
        </label>
        <label className="block text-sm font-medium text-console-ink">
          Fresh six-digit authenticator code
          <input required name="totp" type="text" inputMode="numeric"
            pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code"
            className="mt-2 min-h-11 w-full rounded-lg border border-console-line bg-white px-3"/>
        </label>
        <button type="submit" disabled={busy||!selected||!connectionId}
          className="min-h-11 rounded-xl bg-console-primary px-4 text-sm font-medium text-white disabled:opacity-50">
          {busy?"Verifying…":"Verify TXT and prepare read-only access"}
        </button>
      </form>:null}
    </div>:null}
    {issue?<p role="alert" className="mt-3 text-sm text-rose-700">{issue}</p>:null}
    {message?<p role="status" className="mt-3 text-sm text-console-ink">{message}</p>:null}
  </Panel>;
}
