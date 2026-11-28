"use client";
import {useState} from "react";
import {api} from "@/lib/api/client";
import {Panel} from "@/components/design-system/Panel";
type Proof={type:"TXT";name:string;value:string;expires_at:string};
export function HostingDomainProof({serviceId}:{serviceId:string}){
 const [record,setRecord]=useState<Proof|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 async function load(){
  if(busy)return;setBusy(true);setNotice("");
  try{
   const result=await api.post<{state:string;record?:Proof}>("/services/services/"+encodeURIComponent(serviceId)+"/hosting-domain-proof/",{});
   if(result.state==="pending_dns"&&result.record?.type==="TXT"){setRecord(result.record);setNotice("Add this TXT record at your current DNS provider. Hosting provisioning will proceed automatically after verification.");}
   else{setRecord(null);setNotice("The supplier confirmation is pending.");}
  }catch{setNotice("Domain verification is not available for this service yet.");}
  finally{setBusy(false);}
 }
 return <Panel className="space-y-3"><h3 className="font-medium text-console-ink">Verify your hosting domain</h3><p className="text-sm text-console-muted">Prove control of your domain before we create the hosting account. This does not change its nameservers or existing DNS records.</p>
  <button disabled={busy} onClick={()=>void load()} className="min-h-10 rounded-lg border border-console-line px-3 text-sm font-medium text-console-primary disabled:opacity-50">{busy?"Checking…":record?"Refresh verification instructions":"Get verification record"}</button>
  {record&&<dl className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm">{[["Type",record.type],["Name",record.name],["Value",record.value]].map(([label,value])=><div key={label} className="flex min-w-0 flex-wrap items-center justify-between gap-2"><div className="min-w-0"><dt className="text-xs text-console-muted">{label}</dt><dd className="break-all">{value}</dd></div><button type="button" className="rounded border border-console-line px-2 py-1 text-xs" onClick={async()=>{try{await navigator.clipboard.writeText(value);setNotice("Copied "+label.toLowerCase()+".")}catch{setNotice("Copy the value manually.")}}}>Copy</button></div>)}</dl>}
  {notice&&<p role="status" className="text-sm text-console-muted">{notice}</p>}
 </Panel>
}
