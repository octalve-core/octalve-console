"use client";
import {useEffect,useMemo,useState} from "react";
import {CheckCircle2,RotateCcw,Save,ShieldCheck} from "lucide-react";
import {api,ApiError} from "@/lib/api/client";
import {ActionButton} from "@/components/design-system/ActionButton";
import {Panel} from "@/components/design-system/Panel";
type Field={key:string;label:string;kind:string;value:string;effect:string};
type Snapshot={section:string;revision:string;fields:Field[];editable:boolean;changed?:string[];audit_ids?:number[]};
const sections=["general","theme","invoices","mail"] as const;
export function ConsolePolicyEditor({section}:{section:string}){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [draft,setDraft]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(true),[saving,setSaving]=useState(false);
 const [error,setError]=useState(""),[saved,setSaved]=useState("");
 const valid=sections.some(s=>s===section);
 async function load(){
  setBusy(true);setError("");setSaved("");
  try{
   const data=await api.get<Snapshot>("/settings/console-policy/"+encodeURIComponent(section)+"/");
   setSnapshot(data);setDraft(Object.fromEntries(data.fields.map(f=>[f.key,f.value])));
  }catch{setSnapshot(null);setError("Settings could not be loaded. Your configuration has not been changed.");}
  finally{setBusy(false);}
 }
 useEffect(()=>{if(valid)void load();},[section,valid]);
 const changed=useMemo(()=>snapshot?.fields.filter(f=>draft[f.key]!==f.value)||[],[snapshot,draft]);
 async function save(){
  if(!snapshot||!changed.length||saving)return;
  setSaving(true);setError("");setSaved("");
  try{
   const data=await api.patch<Snapshot>("/settings/console-policy/"+encodeURIComponent(section)+"/",{
    revision:snapshot.revision,changes:Object.fromEntries(changed.map(f=>[f.key,draft[f.key]]))
   });
   setSnapshot(data);setDraft(Object.fromEntries(data.fields.map(f=>[f.key,f.value])));
   setSaved(data.changed?.length?"Saved and recorded in the configuration audit history.":"Your settings are already up to date.");
  }catch(e){
   setError(e instanceof ApiError&&e.status===409?"These settings changed elsewhere. Reload to review the latest values.":"The changes were not saved. Review field values and permissions.");
  }finally{setSaving(false);}
 }
 if(!valid)return null;
 return <Panel className="xl:col-span-2" aria-busy={busy||saving}>
  <div className="mb-4 flex items-start gap-3">
   <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-console-primary"><ShieldCheck className="h-5 w-5" aria-hidden="true"/></span>
   <div><h2 className="text-lg font-medium text-console-ink">Console configuration</h2>
    <p className="mt-1 text-sm text-console-muted">Only saved changes are applied. Connected services keep their own permissions.</p></div>
  </div>
  {busy?<p role="status" className="text-sm text-console-muted">Loading current settings…</p>:null}
  {error?<p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>:null}
  {saved?<p role="status" className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" aria-hidden="true"/>{saved}</p>:null}
  {snapshot?<form onSubmit={e=>{e.preventDefault();void save();}} className="space-y-5">
   <div className="grid min-w-0 gap-4 md:grid-cols-2">
    {snapshot.fields.map(field=>{
     const choices=field.kind.startsWith("select:")?field.kind.slice(7).split(","):null;
     return <div key={field.key} className={field.kind==="footer"?"min-w-0 md:col-span-2":"min-w-0"}>
      <label htmlFor={"setting-"+field.key} className="mb-2 block text-sm font-medium text-console-ink">{field.label}</label>
      {choices?<select id={"setting-"+field.key} name={field.key} value={draft[field.key]??""}
         onChange={e=>setDraft(v=>({...v,[field.key]:e.target.value}))} disabled={saving}
         className="min-h-11 w-full rounded-xl border border-console-line bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-console-primary">
         {choices.map(v=><option key={v} value={v}>{v==="template_01"?"Invoice Template 01":v}</option>)}</select>:
        field.kind==="footer"?<textarea id={"setting-"+field.key} name={field.key} rows={3} maxLength={500} value={draft[field.key]??""}
          onChange={e=>setDraft(v=>({...v,[field.key]:e.target.value}))} disabled={saving}
          className="w-full rounded-xl border border-console-line bg-white p-3 text-sm focus-visible:outline-2 focus-visible:outline-console-primary"/>:
        <input id={"setting-"+field.key} name={field.key} type={field.kind==="email"?"email":field.kind==="days"?"number":"text"} min={field.kind==="days"?1:undefined} max={field.kind==="days"?30:undefined}
          maxLength={100} value={draft[field.key]??""} onChange={e=>setDraft(v=>({...v,[field.key]:e.target.value}))} disabled={saving}
          className="min-h-11 w-full rounded-xl border border-console-line bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-console-primary"/>}
      {field.effect==="draft_only"||field.effect==="pilot_only"||field.effect==="preview_only"?
       <p className="mt-1 text-xs leading-5 text-console-muted">{field.effect==="draft_only"?"Saved policy; automatic execution is not enabled.":field.effect==="pilot_only"?"Available for approved multilingual rollout only.":"Preview choice; it does not change issued documents."}</p>:null}
     </div>;
    })}
   </div>
   {section==="theme"?<div aria-label="Colour preview" className="rounded-xl border border-console-line p-5"
     style={{background:draft.canvas_color,color:"#071425"}}>
     <span className="text-sm font-medium">Appearance preview</span>
     <div className="mt-3 rounded-lg px-4 py-3 text-sm font-medium text-white"
       style={{background:draft.primary_color}}>Primary action preview</div></div>:null}
   <div className="flex flex-wrap items-center justify-between gap-3 border-t border-console-line pt-4">
    <span className="text-xs text-console-muted">{changed.length?changed.length+" unsaved change(s)":"All changes saved"}</span>
    <div className="flex flex-wrap gap-2">
     <ActionButton type="button" variant="outline" onClick={()=>{void load();}} disabled={busy||saving}
       leadingIcon={<RotateCcw className="h-4 w-4" aria-hidden="true"/>}>Reload</ActionButton>
     <ActionButton type="submit" disabled={!changed.length||saving}
       leadingIcon={<Save className="h-4 w-4" aria-hidden="true"/>}>{saving?"Saving…":"Save changes"}</ActionButton>
    </div>
   </div>
  </form>:null}
 </Panel>;
}
