"use client";
import {useEffect,useState} from "react";
import {Save,RotateCcw,History,ShieldAlert} from "lucide-react";
import {api,ApiError} from "@/lib/api/client";
import {Panel} from "@/components/design-system/Panel";
type Values={enable_tax:boolean;default_tax_rate:string;tax_calculation:"exclusive"|"inclusive";enable_tax_exemption:boolean;vat_number:string};
type Tax={revision:string;values:Values;checkout_active:boolean;message:string;audit_id?:number};
export function ConsoleTaxEditor(){
 const [saved,setSaved]=useState<Tax|null>(null),[draft,setDraft]=useState<Values|null>(null);
 const [busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [history,setHistory]=useState<Array<{revision:number;created_at:string;snapshot:Record<string,unknown>}>>([]);
 const [historyOpen,setHistoryOpen]=useState(false);
 async function load(){setBusy(true);setError("");setNotice("");
  try{const data=await api.get<Tax>("/settings/console-tax/");setSaved(data);setDraft({...data.values});}
  catch{setError("Tax settings could not be loaded.");}finally{setBusy(false);}
 }
 useEffect(()=>{void load();},[]);
 async function loadHistory(){
  setError("");
  try{const data=await api.get<{revisions:typeof history}>("/settings/console-tax/history/");
   setHistory(data.revisions);setHistoryOpen(true);
  }catch{setError("Tax revision history could not be loaded.");}
 }
 const changes:Partial<Values>=saved&&draft?Object.fromEntries((Object.keys(draft) as (keyof Values)[])
  .filter(k=>draft[k]!==saved.values[k]).map(k=>[k,draft[k]])):{};
 async function submit(){if(!saved||!draft||!Object.keys(changes).length)return;
  setSaving(true);setError("");setNotice("");
  try{const result=await api.patch<Tax>("/settings/console-tax/",{revision:saved.revision,changes});
   setSaved(result);setDraft({...result.values});setNotice("Tax policy saved. Checkout remains unchanged.");
  }catch(e){setError(e instanceof ApiError&&e.status===409?"Tax settings changed. Reload to review the latest values.":"Could not save tax policy; review the rate and fields.");}
  finally{setSaving(false);}
 }
 return <Panel className="xl:col-span-2">
  <h2 className="text-lg font-medium text-console-ink">Tax policy</h2>
  <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-console-muted"><ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-console-primary"/>Saved tax preferences are not automatically applied to customer checkout. Tax activation requires a separately verified financial calculation and invoice snapshot.</p>
  {busy?<p role="status" className="mt-3 text-sm text-console-muted">Loading current tax policy…</p>:null}
  {error?<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>:null}
  {notice?<p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>:null}
  {draft?<form className="mt-5 space-y-4" onSubmit={e=>{e.preventDefault();void submit();}}>
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-medium text-console-ink">Default tax rate (%)
     <input type="number" min={0} max={30} step=".01" value={draft.default_tax_rate}
      onChange={e=>setDraft(v=>v?{...v,default_tax_rate:e.target.value}:v)}
      className="mt-2 min-h-11 w-full rounded-xl border border-console-line px-3" /></label>
    <label className="text-sm font-medium text-console-ink">Calculation mode
     <select value={draft.tax_calculation} onChange={e=>setDraft(v=>v?{...v,tax_calculation:e.target.value as Values["tax_calculation"]}:v)}
      className="mt-2 min-h-11 w-full rounded-xl border border-console-line bg-white px-3">
      <option value="exclusive">Tax added to price</option><option value="inclusive">Tax included in price</option></select></label>
    <label className="text-sm font-medium text-console-ink">Company tax registration
     <input maxLength={100} value={draft.vat_number} onChange={e=>setDraft(v=>v?{...v,vat_number:e.target.value}:v)}
      className="mt-2 min-h-11 w-full rounded-xl border border-console-line px-3"/></label>
   </div>
   <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-blue-600"
     checked={draft.enable_tax} onChange={e=>setDraft(v=>v?{...v,enable_tax:e.target.checked}:v)}/>Enable tax in saved policy (checkout not connected)</label>
   <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-blue-600"
     checked={draft.enable_tax_exemption} onChange={e=>setDraft(v=>v?{...v,enable_tax_exemption:e.target.checked}:v)}/>Allow tax-exempt accounts in policy</label>
   <div className="flex flex-wrap justify-end gap-2 border-t border-console-line pt-4">
    <button type="button" onClick={()=>{void loadHistory();}} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-console-line px-4"><History aria-hidden="true" className="h-4 w-4"/>History</button>
    <button type="button" onClick={()=>{void load();}} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-console-line px-4"><RotateCcw aria-hidden="true" className="h-4 w-4"/>Reload</button>
    <button type="submit" disabled={saving||!Object.keys(changes).length}
     className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-console-primary px-4 text-white disabled:opacity-50"><Save aria-hidden="true" className="h-4 w-4"/>Save tax policy</button>
   </div>
  </form>:null}
  {historyOpen?<section aria-label="Saved tax revisions" className="mt-5 border-t border-console-line pt-4">
   <h3 className="text-sm font-medium text-console-ink">Tax policy history</h3>
   {history.length?<ol className="mt-3 space-y-2">{history.map(row=><li key={row.revision} className="rounded-lg bg-slate-50 p-3 text-sm">
    <span className="font-medium">Revision {row.revision}</span>
    <span className="ml-2 text-xs text-console-muted">{new Date(row.created_at).toLocaleDateString()}</span>
    <p className="mt-1 text-xs text-console-muted">Rate: {String(row.snapshot.default_tax_rate??"—")}% · {String(row.snapshot.tax_calculation??"—")}</p>
   </li>)}</ol>:<p className="mt-2 text-sm text-console-muted">No saved revisions yet.</p>}
  </section>:null}
 </Panel>;
}
