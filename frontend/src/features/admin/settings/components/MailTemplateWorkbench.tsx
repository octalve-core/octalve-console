"use client";
import {useEffect,useMemo,useState} from "react";
import {Copy,Eye,History,MailCheck,Plus,Save,Search,ShieldCheck} from "lucide-react";
import {api} from "@/lib/api/client";
import {Panel} from "@/components/design-system/Panel";
type Template={id:number;key:string;name:string;category:string;subject:string;body_text:string;
 is_active:boolean;is_system:boolean;revision:string};
type SenderReadiness={primary:string;fallback:string;outbound_enabled:boolean;status:string;
 senders:{key:string;label:string;guide:string;live_verified:boolean;draft_connections:number;free_daily_quota:number|null}[]};
type Outbox={counts:Record<string,number>;sender_ready:boolean;message:string;
 results:{id:number;recipient:string;subject:string;status:string;attempts:number;created_at:string}[]};
const categories=["auth","billing","support","provisioning","domains","system","marketing"];
const blank={name:"",category:"billing",subject:"",body_text:"",is_active:false};
export function MailTemplateWorkbench(){
 const [items,setItems]=useState<Template[]>([]);
 const [selected,setSelected]=useState<number|null>(null);
 const [values,setValues]=useState({...blank});
 const [filter,setFilter]=useState("");
 const [outbox,setOutbox]=useState<Outbox|null>(null);
 const [senderStatus,setSenderStatus]=useState<SenderReadiness|null>(null);
 const [busy,setBusy]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [preview,setPreview]=useState<{subject:string;body_text:string}|null>(null);
 const [history,setHistory]=useState<Array<{id:number;revision:number;created_at:string;snapshot:Record<string,unknown>}>>([]);
 const [historyOpen,setHistoryOpen]=useState(false);
 const current=items.find(t=>t.id===selected);
 const visible=useMemo(()=>items.filter(t=>[t.name,t.subject,t.category].some(v=>v.toLowerCase().includes(filter.toLowerCase()))),[items,filter]);
 async function load(){
  setBusy(true);setError("");
  try{
   const [templates,queue,senders]=await Promise.all([
    api.get<{results:Template[]}>("/settings/console-mail/templates/"),
    api.get<Outbox>("/settings/console-mail/outbox/"),
    api.get<SenderReadiness>("/settings/console-mail/senders/")]);
   setItems(templates.results);setOutbox(queue);setSenderStatus(senders);
  }catch{setError("Email configuration could not be loaded. No messages have been sent.");}
  finally{setBusy(false);}
 }
 useEffect(()=>{void load();},[]);
 function choose(template:Template|null){
  setSelected(template?.id??null);setValues(template?{
   name:template.name,category:template.category,subject:template.subject,body_text:template.body_text,is_active:template.is_active
  }:{...blank});setError("");setNotice("");setPreview(null);setHistory([]);setHistoryOpen(false);
 }
 async function save(){
  if(saving)return;
  setSaving(true);setError("");setNotice("");
  try{
   const endpoint="/settings/console-mail/templates/";
   const response=current?
    await api.patch<Template>(endpoint+current.id+"/",{revision:current.revision,...values}):
    await api.post<Template>(endpoint,values);
   setItems(rows=>[response,...rows.filter(t=>t.id!==response.id)]);
   choose(response);setNotice("Template saved. This does not send an email.");
  }catch{setError("Template was not saved. Review required fields and check for a newer revision.");}
  finally{setSaving(false);}
 }
 async function duplicate(){
  if(!current||saving)return;
  setSaving(true);setError("");setNotice("");
  try{
   const response=await api.post<Template>("/settings/console-mail/templates/"+current.id+"/duplicate/",{});
   setItems(rows=>[response,...rows]);choose(response);setNotice("Copy created as inactive.");
  }catch{setError("Could not duplicate the template.");}
  finally{setSaving(false);}
 }
 async function showHistory(){
  if(!current)return;
  setError("");setHistoryOpen(false);
  try{
   const result=await api.get<{revisions:typeof history}>("/settings/console-mail/templates/"+current.id+"/history/");
   setHistory(result.revisions);setHistoryOpen(true);
  }catch{setError("Template history could not be loaded.");}
 }
 async function showPreview(){
  if(!current)return;
  setPreview(null);setError("");
  try{
   const response=await api.post<{subject:string;body_text:string}>("/settings/console-mail/templates/"+current.id+"/preview/",{});
   setPreview(response);
  }catch{setError("Preview is unavailable. Check template personalization variables.");}
 }
 return <div className="min-w-0 space-y-5 xl:col-span-3">
  <Panel>
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div><h2 className="text-lg font-medium text-console-ink">Email templates</h2>
     <p className="mt-1 text-sm text-console-muted">Edit, duplicate and preview personalized messages for customer events.</p></div>
    <button type="button" onClick={()=>choose(null)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-console-primary px-4 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-primary">
     <Plus className="h-4 w-4" aria-hidden="true"/>New template</button>
   </div>
   {error?<p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>:null}
   {notice?<p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>:null}
   <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
    <div className="min-w-0">
     <label htmlFor="template-search" className="mb-2 block text-sm font-medium text-console-ink">Find a template</label>
     <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-console-muted" aria-hidden="true"/>
      <input id="template-search" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search templates"
       className="min-h-11 w-full rounded-xl border border-console-line py-2 pl-10 pr-3 text-sm"/></div>
     <div className="mt-3 max-h-[38rem] space-y-2 overflow-y-auto" aria-label="Saved templates">
      {busy?<p role="status" className="text-sm text-console-muted">Loading templates…</p>:null}
      {!busy&&!visible.length?<p className="text-sm text-console-muted">No matching templates.</p>:null}
      {visible.map(item=><button type="button" key={item.id} onClick={()=>choose(item)}
       aria-pressed={selected===item.id} className={"w-full rounded-xl border p-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-console-primary "+(selected===item.id?"border-console-primary bg-blue-50":"border-console-line bg-white hover:bg-slate-50")}>
       <span className="block break-words font-medium text-console-ink">{item.name}</span>
       <span className="mt-1 block text-xs text-console-muted">{item.category} · {item.is_active?"Active":"Inactive"}</span></button>)}
     </div>
    </div>
    <form onSubmit={e=>{e.preventDefault();void save();}} className="min-w-0 space-y-4">
     <h3 className="text-base font-medium text-console-ink">{current?"Edit template":"New template"}</h3>
     <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-console-ink">Template name
       <input required maxLength={100} value={values.name} onChange={e=>setValues(v=>({...v,name:e.target.value}))}
       className="mt-2 min-h-11 w-full rounded-xl border border-console-line px-3 text-sm"/></label>
      <label className="text-sm font-medium text-console-ink">Category
       <select value={values.category} onChange={e=>setValues(v=>({...v,category:e.target.value}))}
       className="mt-2 min-h-11 w-full rounded-xl border border-console-line bg-white px-3 text-sm">
        {categories.map(v=><option key={v} value={v}>{v}</option>)}
       </select></label>
     </div>
     <label className="block text-sm font-medium text-console-ink">Subject
      <input required maxLength={200} value={values.subject} onChange={e=>setValues(v=>({...v,subject:e.target.value}))}
       placeholder="Hello {{customer.first_name}}" className="mt-2 min-h-11 w-full rounded-xl border border-console-line px-3 text-sm"/></label>
     <label className="block text-sm font-medium text-console-ink">Email body (plain text)
      <textarea required rows={8} maxLength={12000} value={values.body_text} onChange={e=>setValues(v=>({...v,body_text:e.target.value}))}
       placeholder="Hello {{customer.first_name}},"
       className="mt-2 w-full rounded-xl border border-console-line p-3 text-sm"/></label>
     <p className="text-xs leading-5 text-console-muted">Available personalization: customer.first_name, customer.full_name, invoice.number, invoice.due_date, order.number, domain.name, ticket.number, company.name and year. All output is HTML-escaped before delivery.</p>
     <label className="flex cursor-pointer items-center gap-3 text-sm text-console-ink">
      <input type="checkbox" checked={values.is_active} onChange={e=>setValues(v=>({...v,is_active:e.target.checked}))}
       className="h-5 w-5 accent-blue-600"/>Template active</label>
     <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-console-primary px-4 text-sm text-white disabled:opacity-60"><Save className="h-4 w-4" aria-hidden="true"/>{saving?"Saving…":"Save template"}</button>
      {current?<><button type="button" onClick={()=>{void duplicate();}} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-console-line px-4 text-sm"><Copy className="h-4 w-4" aria-hidden="true"/>Duplicate</button>
      <button type="button" onClick={()=>{void showPreview();}} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-console-line px-4 text-sm"><Eye className="h-4 w-4" aria-hidden="true"/>Preview saved</button>
      <button type="button" onClick={()=>{void showHistory();}} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-console-line px-4 text-sm"><History className="h-4 w-4" aria-hidden="true"/>History</button></>:null}
     </div>
     {historyOpen?<div aria-label="Saved template revisions" className="rounded-xl border border-console-line bg-slate-50 p-4">
      <h4 className="text-sm font-medium text-console-ink">Saved revisions</h4>
      {history.length?<ol className="mt-3 space-y-3">{history.map(item=><li key={item.id} className="rounded-lg border border-console-line bg-white p-3">
       <div className="text-xs text-console-muted">Revision {item.revision} · {new Date(item.created_at).toLocaleDateString()}</div>
       <div className="mt-1 break-words text-sm font-medium text-console-ink">{typeof item.snapshot.subject==="string"?item.snapshot.subject:"Original template"}</div>
       <p className="mt-1 text-xs text-console-muted">Read-only revision. Editing requires a new Save.</p>
      </li>)}</ol>:<p className="mt-3 text-xs text-console-muted">No previous revisions.</p>}</div>:null}
     {preview?<div className="rounded-xl border border-console-line bg-slate-50 p-4" aria-label="Safe template preview">
      <h4 className="text-sm font-medium text-console-ink">{preview.subject}</h4>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-console-muted">{preview.body_text}</p></div>:null}
    </form>
   </div>
  </Panel>
  <Panel>
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="text-lg font-medium text-console-ink">Email delivery providers</h2>
    <p className="mt-1 text-sm text-console-muted">Choose Brevo first, with Resend as backup. These are saved preferences—not active credentials or certified sending.</p></div>
   <a href="/admin/integrations" className="inline-flex min-h-11 items-center rounded-xl border border-console-line px-4 text-sm font-medium text-console-primary hover:bg-blue-50">Open Integration Store</a>
  </div>
  {senderStatus?<div className="mt-4 grid gap-3 sm:grid-cols-2">
   {senderStatus.senders.map(sender=><div key={sender.key} className="min-w-0 rounded-xl border border-console-line bg-slate-50 p-4">
    <p className="text-sm font-medium text-console-ink">{sender.label} {senderStatus.primary===sender.key?"· Preferred":senderStatus.fallback===sender.key?"· Backup":""}</p>
    <p className="mt-2 text-xs text-console-muted">Status: Not connected for live sending</p>
    {sender.free_daily_quota?<p className="mt-2 text-xs text-console-muted">Free tier: up to {sender.free_daily_quota} emails per day, subject to the provider's current limits.</p>:null}
    <a href={sender.guide} rel="noopener noreferrer" target="_blank" className="mt-3 inline-flex text-sm font-medium text-console-primary underline underline-offset-2">Domain verification instructions</a>
   </div>)}
  </div>:<p className="mt-3 text-sm text-console-muted">Checking email service readiness…</p>}
  <p className="mt-4 text-xs leading-5 text-console-muted">Authenticate your owned sending domain with DKIM and DMARC. Ensure SPF alignment, monitor bounces and complaints, and separate transactional mail from opted-in promotions. No provider can guarantee inbox placement.</p>
 </Panel>
 <Panel>
   <div className="flex items-start gap-3"><MailCheck className="mt-1 h-5 w-5 text-console-primary" aria-hidden="true"/>
    <div><h2 className="text-lg font-medium text-console-ink">Delivery queue</h2>
     <p className="mt-1 text-sm text-console-muted">Recorded delivery intent and attempts. Sender verification is required before external delivery.</p></div></div>
   {outbox?<><dl className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{Object.entries(outbox.counts).map(([state,count])=><div key={state} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs capitalize text-console-muted">{state.replace("_"," ")}</dt><dd className="mt-1 text-xl font-medium text-console-ink">{count}</dd></div>)}</dl>
    {outbox.results.length?<ul className="mt-4 divide-y divide-console-line">{outbox.results.map(item=><li key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="break-all">{item.subject} — {item.recipient}</span><span className="capitalize text-console-muted">{item.status.replace("_"," ")}</span></li>)}</ul>:<p className="mt-4 text-sm text-console-muted">No queued messages yet.</p>}
    <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-console-muted"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true"/>No external sender is certified in this workspace. Configure and verify connections in Integrations before enabling delivery.</p>
   </>:null}
  </Panel>
 </div>;
}
