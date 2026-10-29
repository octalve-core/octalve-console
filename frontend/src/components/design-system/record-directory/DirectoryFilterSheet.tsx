"use client";
import {useEffect,useState} from "react";
import {AdaptiveSheet} from "@/components/design-system/AdaptiveSheet";
import type {DirectoryFilter} from "./types";
export function DirectoryFilterSheet({open,onClose,initial,statuses,categories,onApply}:{open:boolean;
 onClose:()=>void;initial:DirectoryFilter;statuses:readonly string[];categories:readonly string[];
 onApply:(filter:DirectoryFilter)=>void}){
 const [draft,setDraft]=useState(initial);
 useEffect(()=>{if(open)setDraft(initial);},[open,initial]);
 const invalid=Boolean(draft.from&&draft.to&&draft.from>draft.to);
 return <AdaptiveSheet open={open} onClose={onClose} title="Filter records">
  <form onSubmit={e=>{e.preventDefault();if(!invalid){onApply(draft);onClose();}}} className="space-y-4">
   <fieldset><legend className="mb-2 text-xs font-medium text-console-ink">Status</legend>
    <div className="flex flex-wrap gap-2">{["all",...statuses].map(status=><label key={status} className={`cursor-pointer rounded-full px-3 py-2 text-xs font-medium ${draft.status===status?"bg-blue-50 text-console-primary":"bg-slate-100 text-console-muted"}`}>
     <input type="radio" name="record-status" value={status} checked={draft.status===status} onChange={()=>setDraft(d=>({...d,status}))} className="sr-only"/>{status==="all"?"All":status.replaceAll("_"," ")}
    </label>)}</div>
   </fieldset>
   {categories.length?<label className="block text-xs font-medium text-console-ink">Category
    <select value={draft.category} onChange={e=>setDraft(d=>({...d,category:e.target.value}))}
     className="mt-1 block min-h-10 w-full rounded-lg border border-console-line bg-white px-3 text-sm">
     <option value="all">All categories</option>{categories.map(x=><option key={x} value={x}>{x}</option>)}
    </select></label>:null}
   <fieldset><legend className="mb-2 text-xs font-medium text-console-ink">Record date (when provided)</legend>
    <div className="grid grid-cols-2 gap-2">
     <label className="text-xs text-console-muted">From<input type="date" value={draft.from} onChange={e=>setDraft(d=>({...d,from:e.target.value}))}
      className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-console-line px-2 text-xs"/></label>
     <label className="text-xs text-console-muted">To<input type="date" value={draft.to} onChange={e=>setDraft(d=>({...d,to:e.target.value}))}
      className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-console-line px-2 text-xs"/></label>
    </div>{invalid?<p role="alert" className="mt-2 text-xs text-rose-700">End date cannot precede start date.</p>:null}
   </fieldset>
   <div className="grid grid-cols-2 gap-2 border-t border-console-line pt-4">
    <button type="button" onClick={()=>{onApply({status:"all",category:"all",from:"",to:""});onClose();}} className="min-h-11 rounded-full border border-console-line text-[13px] font-medium">Clear</button>
    <button type="submit" disabled={invalid} className="min-h-11 rounded-full bg-console-primary px-3 text-[13px] font-medium text-white disabled:opacity-40">Apply filters</button>
   </div>
  </form>
 </AdaptiveSheet>;
}
