"use client";
import {useMemo,useState} from "react";
import {ChevronLeft,ChevronRight,Search} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {TextField} from "@/components/design-system/TextField";
import {SelectField} from "@/components/design-system/SelectField";
import {ActionButton} from "@/components/design-system/ActionButton";
import {ActionLink} from "@/components/design-system/ActionLink";
import {ResponsiveTable,type ResponsiveColumn} from "@/components/design-system/ResponsiveTable";
import {StatusBadge,type StatusTone} from "@/components/design-system/StatusBadge";
import {getStatusTone,formatStatus} from "@/lib/constants/status";
import type {AdminRecord} from "../data/admin-demo-data";
import type {AdminResourceKey} from "../data/admin-resource-config";
const PAGE_SIZE=10;
function tone(status:string):StatusTone{const v=getStatusTone(status);return v==="danger"?"error":v;}
export function AdminResourceDirectory({resource,records,emptyTitle,emptyDescription,detailEnabled=true}:{
 resource:AdminResourceKey;records:readonly AdminRecord[];emptyTitle:string;emptyDescription:string;detailEnabled?:boolean;
}){
 const [query,setQuery]=useState(""),[status,setStatus]=useState("all"),[page,setPage]=useState(1);
 const statuses=useMemo(()=>[...new Set(records.map(r=>r.status))].sort(),[records]);
 const filtered=useMemo(()=>records.filter(r=>{
  if(status!=="all"&&r.status!==status)return false;
  const value=query.trim().toLowerCase();
  return !value||[r.id,r.title,r.subtitle,r.meta,r.status,r.amount??"",r.date??""].some(x=>x.toLowerCase().includes(value));
 }),[records,status,query]);
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)),current=Math.min(page,pages);
 const columns:ResponsiveColumn<AdminRecord>[]=[
  {key:"name",heading:resource==="customers"?"Customer":resource==="domains"?"Domain":resource==="orders"?"Order":resource==="invoices"?"Invoice":"Record",
   cell:r=><span className="break-words font-semibold text-console-ink">{r.title}</span>},
  {key:"details",heading:"Details",cell:r=>r.subtitle||"—"},
  {key:"reference",heading:"Reference / category",cell:r=><span className="break-words text-console-primary">{r.meta||"—"}</span>},
  {key:"amount",heading:"Amount",cell:r=>r.amount||"—"},
  {key:"date",heading:"Updated / created",cell:r=>r.date||"—"},
  {key:"status",heading:"Status",cell:r=><StatusBadge tone={tone(r.status)}>{formatStatus(r.status)}</StatusBadge>},
  ...(detailEnabled?[{key:"view",heading:"Details",cell:(r:AdminRecord)=><ActionLink size="sm" variant="outline" href={r.actionHref}
   className="w-full sm:w-auto">View record</ActionLink>}]:[])
 ];
 const visible=filtered.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE);
 return <Panel padded={false} className="overflow-hidden">
  <div className="grid min-w-0 gap-4 border-b border-console-line p-4 sm:grid-cols-2 sm:p-5">
   <TextField label={"Search "+resource} type="search" placeholder="Search names, references or details"
    value={query} startIcon={<Search aria-hidden="true" className="h-4 w-4"/>}
    onChange={event=>{setQuery(event.target.value);setPage(1);}}/>
   <SelectField label="Status" value={status} options={[{value:"all",label:"All statuses"},
    ...statuses.map(value=>({value,label:formatStatus(value)}))]}
    onChange={event=>{setStatus(event.target.value);setPage(1);}}/>
  </div>
  <div className="min-w-0 p-4 sm:p-5">
   <p className="mb-3 text-xs text-console-muted">{filtered.length} {resource} found</p>
   <ResponsiveTable caption={"Admin "+resource} rows={visible} columns={columns} getRowKey={r=>r.id}
    emptyTitle={filtered.length===0&&records.length>0?"No matching records":emptyTitle}
    emptyDescription={filtered.length===0&&records.length>0?"Try another search or filter.":emptyDescription}/>
  </div>
  <div className="flex items-center justify-between gap-3 border-t border-console-line px-4 py-3 sm:px-5">
   <ActionButton size="sm" variant="outline" disabled={current===1}
    leadingIcon={<ChevronLeft aria-hidden="true" className="h-4 w-4"/>} onClick={()=>setPage(n=>Math.max(1,n-1))}>Previous</ActionButton>
   <p className="text-xs text-console-muted">Page {current} of {pages}</p>
   <ActionButton size="sm" variant="outline" disabled={current>=pages}
    trailingIcon={<ChevronRight aria-hidden="true" className="h-4 w-4"/>} onClick={()=>setPage(n=>Math.min(pages,n+1))}>Next</ActionButton>
  </div>
 </Panel>;
}
