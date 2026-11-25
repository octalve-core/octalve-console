"use client";

import {useEffect,useState,type FormEvent} from "react";
import {CheckCircle2,Copy,Globe2,ShieldCheck,RefreshCw} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {clientApi,type ExternalDNSClaim,type ExternalDNSClaimIssued} from "@/lib/api/endpoints";

const canonical = (value:string) => value.trim().toLowerCase().replace(/\.$/,"");
const nameValid = (value:string) =>
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(value);

export function ClientDNSClaimPanel(){
  const [open,setOpen]=useState(false);
  const [domain,setDomain]=useState("");
  const [claims,setClaims]=useState<ExternalDNSClaim[]>([]);
  const [issued,setIssued]=useState<ExternalDNSClaimIssued|null>(null);
  const [busy,setBusy]=useState(false);
  const [available,setAvailable]=useState(false);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);

  useEffect(()=>{
    let active=true;
    void clientApi.dnsOnlyClaims().then(data=>{
      if(active&&data.execution_enabled===false&&Array.isArray(data.results)){
        setAvailable(true);setClaims(data.results.slice(0,30));
      }
    }).catch(()=>{if(active)setAvailable(false);});
    return ()=>{active=false;};
  },[]);

  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const name=canonical(domain);
    if(!nameValid(name)||busy)return;
    setBusy(true);setError("");setCopied(false);
    try{
      const response=await clientApi.beginDnsOnlyClaim(name);
      if(response.domain_name!==name||response.challenge.type!=="TXT"||
         response.challenge.name!=="_octalve-verify."+name||
         !response.challenge.value.startsWith("octalve-verify=")||
         response.registration_confirmed!==false||response.execution_enabled!==false)
        throw Error("Verification response could not be confirmed.");
      setIssued(response);
      setClaims(previous=>[response,...previous.filter(item=>item.id!==response.id)]);
      setDomain("");
    }catch{
      setError("The domain could not be prepared. It may already be claimed, or this service may be temporarily unavailable.");
    }finally{setBusy(false);}
  }

  async function copy(value:string){
    try{await navigator.clipboard.writeText(value);setCopied(true);}
    catch{setCopied(false);}
  }

  return <Panel>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-blue-50 p-3 text-console-primary">
          <Globe2 className="h-5 w-5" aria-hidden="true"/>
        </span>
        <div>
          <h2 className="text-base font-medium text-console-ink">Connect a domain you already own</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-console-muted">
            Verify your domain to connect it to Octalve Cloud.
          </p>
        </div>
      </div>
      {available?<button type="button" onClick={()=>setOpen(!open)}
        className="min-h-10 rounded-xl border border-console-line px-4 text-sm font-medium text-console-ink">
        {open?"Close":"Connect domain"}
      </button>:<span className="text-xs text-console-muted">Enrollment not currently available</span>}
    </div>
    {available&&open?<form onSubmit={e=>void create(e)} className="mt-5 space-y-3">
      <label className="block text-sm font-medium text-console-ink" htmlFor="external-domain">
        Your existing domain
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <input id="external-domain" type="text" autoComplete="off" value={domain}
          onChange={e=>setDomain(e.target.value)} required
          placeholder="yourcompany.com"
          className="min-h-11 min-w-48 flex-1 rounded-xl border border-console-line bg-white px-3 text-sm text-console-ink"/>
        <button type="submit" disabled={busy||!nameValid(canonical(domain))}
          className="min-h-11 rounded-xl bg-console-primary px-5 text-sm font-medium text-white disabled:opacity-50">
          {busy?"Preparing…":"Get verification record"}
        </button>
      </div>
      {error?<p role="alert" className="text-sm text-rose-700">{error}</p>:null}

    </form>:null}
    {issued?<div className="mt-5 rounded-xl border border-console-line bg-slate-50 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-console-primary" aria-hidden="true"/>
        <h3 className="text-sm font-medium text-console-ink">One-time DNS verification</h3>
      </div>
      <p className="mt-2 text-sm text-console-muted">
        Add this TXT record in the DNS settings for
        <span className="font-medium text-console-ink"> {issued.domain_name}</span>.
        The record expires for verification on {new Date(issued.challenge.expires_at).toLocaleString("en-NG")}.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <p className="text-xs text-console-muted">Record type</p>
          <p className="font-mono text-sm text-console-ink">TXT</p>
        </div>
        {([{title:"Hostname",value:issued.challenge.name},
           {title:"Value",value:issued.challenge.value}] as const).map(item=>
          <div key={item.title} className="flex items-center gap-2 rounded-lg border border-console-line bg-white p-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-console-muted">{item.title}</p>
              <p className="break-all font-mono text-xs text-console-ink">{item.value}</p>
            </div>
            <button type="button" aria-label={"Copy "+item.title} onClick={()=>void copy(item.value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-console-line">
              <Copy className="h-4 w-4 text-console-ink"/>
            </button>
          </div>)}
      </div>
      {copied?<p role="status" className="mt-2 flex items-center gap-2 text-xs text-console-muted">
        <CheckCircle2 className="h-4 w-4"/>Copied to clipboard</p>:null}
      <p className="mt-3 text-xs leading-5 text-console-muted">
        Contact support after adding the record. Keep it in place to maintain read-only DNS access.
      </p>
    </div>:null}
    {available&&claims.length>0?<div className="mt-5 border-t border-console-line pt-4">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-console-muted"/>
        <h3 className="text-sm font-medium text-console-ink">Recent verification requests</h3>
      </div>
      <div className="mt-3 space-y-2">
        {claims.slice(0,6).map(item=><div key={item.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-console-line px-3 py-2">
          <p className="break-all text-sm font-medium text-console-ink">{item.domain_name}</p>
          <span className="text-xs text-console-muted">
            {item.state==="verified"?"Domain verified":item.state==="pending"?
              "Awaiting TXT verification":item.state==="expired"?"Challenge expired — request a new one":"Request cancelled"}
          </span>
        </div>)}
      </div>
    </div>:null}
  </Panel>;
}
