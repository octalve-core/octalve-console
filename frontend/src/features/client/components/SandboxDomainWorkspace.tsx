"use client";
import {useEffect,useRef,useState} from "react";
import {Globe2,Plus,Pencil,Trash2,RefreshCw} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";

type RecordData={id:string;type:string;name:string;value:string;ttl:number;priority:number|null};
type TestDomain={id:number;domain:string;invoice_reference:string;state:string;registration:string;registered_at:string|null;expires_at:string|null;term_months:number;dns_editable:boolean;payment_verified:boolean;live_dns:false;records:RecordData[]};
const empty={type:"A",name:"@",value:"",ttl:3600,priority:null as number|null};
const button="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-console-line bg-white px-3 text-sm font-medium text-console-ink disabled:opacity-50";
const field="mt-1 block w-full min-w-0 rounded-lg border border-console-line bg-white p-2.5 text-sm";
const date=(v:string|null)=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleDateString("en-NG"):"Not confirmed";

export function SandboxDomainWorkspace(){
 const [domains,setDomains]=useState<TestDomain[]>([]),[loaded,setLoaded]=useState(false),[error,setError]=useState(""),[selected,setSelected]=useState<number|null>(null);
 const [draft,setDraft]=useState(empty),[editing,setEditing]=useState<string|null>(null),[form,setForm]=useState(false),[busy,setBusy]=useState(false),[remove,setRemove]=useState<string|null>(null);
 const lock=useRef(false);
 async function load(sync=false){
  try{const r=await fetch("/api/cloud/domains/sandbox-domains/",{cache:"no-store",...(sync?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"sync"})}:{})});
   if(r.status===404){setLoaded(true);return}
   const d=await r.json();if(!r.ok||d.mode!=="sandbox"||!Array.isArray(d.domains))throw Error();
   setDomains(d.domains);setError("");setLoaded(true)
  }catch{setError("Test domains could not be refreshed. Please try again.");setLoaded(true)}
 }
 useEffect(()=>{void load(true);const timer=setInterval(()=>{if(!lock.current)void load()},30000);return()=>clearInterval(timer)},[]);
 const domain=domains.find(d=>d.id===selected);
 function choose(id:number){setSelected(id);setForm(false);setRemove(null);setEditing(null);setError("")}
 async function mutate(action:"create"|"update"|"delete",id?:string){
  if(!domain?.dns_editable||lock.current)return;
  lock.current=true;setBusy(true);setError("");
  try{const r=await fetch("/api/cloud/domains/sandbox-domains/"+domain.id+"/dns/",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...(id?{id}:{}),...(action!=="delete"?{record:draft}:{})})});
   const d=await r.json();if(!r.ok||d.id!==domain.id||!Array.isArray(d.records)){const detail=typeof d.detail==="string"?d.detail:Array.isArray(d)?d[0]:d.non_field_errors?.[0];throw new Error(typeof detail==="string"?detail:"Unable to save DNS record.")}
   setDomains(old=>old.map(x=>x.id===d.id?d:x));setForm(false);setEditing(null);setRemove(null)
  }catch(e){setError(e instanceof Error?e.message:"Unable to save DNS record.")}
  finally{lock.current=false;setBusy(false)}
 }
 if(!loaded)return <Panel><p role="status" className="text-sm text-console-muted">Checking your test purchases…</p></Panel>;
 if(!domains.length&&!error)return null;
 return <Panel className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-base font-medium"><Globe2 size={18}/>Test domains</h2><p className="mt-1 text-sm text-console-muted">Manage your verified test purchases. DNS changes are saved in a private sandbox, not published to the Internet.</p></div><button className={button} disabled={busy} onClick={()=>void load(true)}><RefreshCw size={15}/>Refresh</button></div>
  <div className="divide-y divide-console-line rounded-lg border border-console-line">{domains.map(d=><div key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="break-all text-sm font-medium">{d.domain}</p><p className="mt-1 text-xs text-console-muted">{d.registration==="supplier_sandbox_confirmed"?"Registrar sandbox confirmed":"Test purchase"} · {d.state==="cancelled"?"Cancelled":d.payment_verified?"Payment verified":"Verifying payment"}</p><p className="mt-1 break-all text-xs text-console-muted">{d.invoice_reference}</p></div><button className={button} disabled={busy||!d.dns_editable} onClick={()=>choose(d.id)}>{selected===d.id?"Selected":"Manage DNS"}</button></div>)}</div>
  {domain&&<section className="space-y-3 rounded-xl border border-console-line p-3 sm:p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="break-all font-medium">{domain.domain}</h3><p className="mt-1 text-xs text-console-muted">Sandbox DNS · {domain.term_months} months · Registrar expiry: {date(domain.expires_at)}</p></div><button className={button} disabled={busy||!domain.dns_editable} onClick={()=>{setDraft({...empty});setEditing(null);setForm(true);setRemove(null)}}><Plus size={16}/>Add record</button></div>
  {form&&<form className="space-y-3 rounded-lg bg-slate-50 p-3" onSubmit={e=>{e.preventDefault();void mutate(editing?"update":"create",editing??undefined)}}><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Type<select className={field} value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value,priority:e.target.value==="MX"?10:null})}>{["A","AAAA","CNAME","MX","TXT"].map(t=><option key={t}>{t}</option>)}</select></label><label className="text-sm">Host<input className={field} required maxLength={253} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label className="text-sm sm:col-span-2">Value<input className={field} required maxLength={2048} value={draft.value} onChange={e=>setDraft({...draft,value:e.target.value})}/></label><label className="text-sm">TTL (seconds)<input className={field} type="number" min={60} max={86400} required value={draft.ttl} onChange={e=>setDraft({...draft,ttl:Number(e.target.value)})}/></label>{draft.type==="MX"&&<label className="text-sm">Priority<input className={field} type="number" min={0} max={65535} required value={draft.priority??10} onChange={e=>setDraft({...draft,priority:Number(e.target.value)})}/></label>}</div><div className="flex gap-2"><button type="submit" disabled={busy} className="min-h-10 rounded-lg bg-console-primary px-4 text-sm font-medium text-white disabled:opacity-50">{busy?"Saving…":"Save record"}</button><button type="button" disabled={busy} className={button} onClick={()=>setForm(false)}>Cancel</button></div></form>}
  {!domain.records.length?<p className="rounded-lg bg-slate-50 p-4 text-sm text-console-muted">No DNS records yet. Add a record to begin.</p>:<div className="divide-y divide-console-line">{domain.records.map(rec=><div key={rec.id} className="grid gap-2 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-center"><span className="w-fit rounded bg-slate-100 px-2 py-1 text-xs font-medium">{rec.type}</span><div className="min-w-0 text-sm"><p className="font-medium break-all">{rec.name}</p><p className="break-all text-console-muted">{rec.value}</p><p className="text-xs text-console-muted">TTL {rec.ttl}s{rec.priority!==null?" · Priority "+rec.priority:""}</p></div><div className="flex gap-2"><button className={button} disabled={busy} aria-label="Edit record" onClick={()=>{const {id,...rest}=rec;setDraft(rest);setEditing(id);setForm(true);setRemove(null)}}><Pencil size={15}/>Edit</button>{remove===rec.id?<><button className={button} disabled={busy} onClick={()=>void mutate("delete",rec.id)}>Confirm delete</button><button className={button} onClick={()=>setRemove(null)}>Cancel</button></>:<button className={button} disabled={busy} aria-label="Delete record" onClick={()=>setRemove(rec.id)}><Trash2 size={15}/></button>}</div></div>)}</div>}
  </section>}
  {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
 </Panel>
}
