"use client";
import {useState} from "react";
import {api} from "@/lib/api/client";
import {Panel} from "@/components/design-system/Panel";

type Observation={domain:string;state:"observed"|"inconsistent"|"unavailable";nameservers:string[];configured_zone_comparison:"matches"|"differs"|"not_connected"|"unavailable";checked_at:string;write_authorized:false;public_propagation_verified:false};
export function DNSAuthorityCheck({domainId,domainName}:{domainId:string;domainName:string}){
 const [result,setResult]=useState<Observation|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 async function run(){
  if(busy)return;
  setBusy(true);setResult(null);setError(false);
  try{
   const response=await api.get<Observation>("/domains/domains/"+encodeURIComponent(domainId)+"/dns-authority/");
   if(response.domain!==domainName||!["observed","inconsistent","unavailable"].includes(response.state)||!Array.isArray(response.nameservers)||response.write_authorized!==false)throw Error("Unverified DNS result");
   setResult(response);
  }catch{setError(true);}
  finally{setBusy(false);}
 }
 return <Panel elevation="flat">
  <h2 className="text-sm font-medium text-console-ink">Public DNS delegation</h2>
  <p className="mt-2 text-xs leading-5 text-console-muted">Check the nameservers observed by two independent public resolvers. This works for any DNS provider, not just Cloudflare. It does not grant permission to edit records.</p>
  <button type="button" disabled={busy} onClick={()=>void run()} className="mt-3 min-h-11 rounded-lg border border-console-line px-3 text-sm font-medium text-console-primary disabled:opacity-50">{busy?"Checking…":"Check public nameservers"}</button>
  {error&&<p role="alert" className="mt-3 text-sm text-rose-700">The public delegation could not be checked.</p>}
  {result&&<div role="status" className="mt-3 space-y-2 text-sm text-console-ink">
    {result.state==="observed"?<><p>Both resolvers returned the same nameservers:</p><ul className="space-y-1 break-all text-xs">{result.nameservers.map(name=><li key={name}>{name}</li>)}</ul></>:<p>{result.state==="inconsistent"?"The resolvers disagree. DNS may be changing; do not assume an authoritative provider.":"Public nameservers could not be confirmed."}</p>}
    <p className="text-xs text-console-muted">{result.configured_zone_comparison==="matches"?"The approved Cloudflare zone matches the observed nameservers.":result.configured_zone_comparison==="differs"?"The approved Cloudflare zone does not match the observed nameservers. Manage records with the actual authoritative DNS provider.":result.configured_zone_comparison==="not_connected"?"No approved Cloudflare zone was compared; use the operator responsible for the observed nameservers.":"The configured zone could not be compared."}</p>
    <p className="text-xs text-console-muted">Observed {new Date(result.checked_at).toLocaleString()}. Record propagation and write permission are separate checks.</p>
  </div>}
 </Panel>
}
