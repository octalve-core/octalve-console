"use client";
import {useMemo,useState} from "react";
import {Search,ChevronLeft,ChevronRight} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {TextField} from "@/components/design-system/TextField";
import {SelectField} from "@/components/design-system/SelectField";
import {ActionButton} from "@/components/design-system/ActionButton";
import {ActionLink} from "@/components/design-system/ActionLink";
import {ResponsiveTable,type ResponsiveColumn} from "@/components/design-system/ResponsiveTable";
import {StatusBadge,type StatusTone} from "@/components/design-system/StatusBadge";
import {getStatusTone,formatStatus} from "@/lib/constants/status";
import type {ClientRecord} from "../../data/client-demo-data";
export type BillingResource="orders"|"invoices";
function tone(status:string):StatusTone{const value=getStatusTone(status);return value==="danger"?"error":value;}
export function BillingRecordDirectory({resource,records,emptyTitle,emptyDescription}:{
 resource:BillingResource;records:readonly ClientRecord[];emptyTitle:string;emptyDescription:string;
}){
 const [search,setSearch]=useState(""),[status,setStatus]=useState("all"),[page,setPage]=useState(1);
 const statuses=useMemo(()=>Array.from(new Set(records.map(r=>r.status))).sort(),[records]);
 const matched=useMemo(()=>records.filter(r=>(status==="all"||r.status===status)&&
  (!search.trim()||[r.id,r.title,r.subtitle,r.meta,r.status,r.amount??""].some(x=>x.toLowerCase().includes(search.trim().toLowerCase())))),
 [records,search,status]);
 const pages=Math.max(1,Math.ceil(matched.length/10)),current=Math.min(page,pages),visible=matched.slice((current-1)*10,current*10);
 const cols:ResponsiveColumn<ClientRecord>[]=[
  {key:"reference",heading:"Reference",cell:r=><span className="break-words font-medium text-console-primary">{r.meta!=="—"?r.meta:r.id}</span>},
  {key:"title",heading:resource==="orders"?"Order":"Invoice",cell:r=><span className="break-words font-medium text-console-ink">{r.title}</span>},
  {key:"amount",heading:"Amount",cell:r=>r.amount??"—"},
  {key:"date",heading:resource==="orders"?"Ordered":"Due / issued",cell:r=>r.date??"—"},
  {key:"status",heading:"Status",cell:r=><StatusBadge tone={tone(r.status)}>{formatStatus(r.status)}</StatusBadge>},
  {key:"view",heading:"Details",cell:r=><ActionLink size="sm" variant="outline" href={r.actionHref} className="w-full sm:w-auto">View details</ActionLink>}
 ];
 return <Panel padded={false} className="overflow-hidden">
  <WorkspaceGrid variant="filters" className="border-b border-console-line p-4 sm:p-5">
   <TextField label={resource==="orders"?"Search orders":"Search invoices"} type="search" value={search}
    startIcon={<Search aria-hidden="true" className="h-4 w-4"/>} placeholder="Search by reference or name"
    onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
   <SelectField label="Status" value={status}
    options={[{value:"all",label:"All statuses"},...statuses.map(s=>({value:s,label:formatStatus(s)}))]}
    onChange={e=>{setStatus(e.target.value);setPage(1);}}/>
  </WorkspaceGrid>
  <div className="min-w-0 p-4 sm:p-5">
   <p className="mb-3 text-xs text-console-muted">{matched.length} {resource} found</p>
   <ResponsiveTable caption={"Your "+resource} rows={visible} columns={cols} getRowKey={r=>r.id}
    emptyTitle={matched.length===0&&records.length>0?"No matching records":emptyTitle}
    emptyDescription={matched.length===0&&records.length>0?"Try another search or filter.":emptyDescription}/>
  </div>
  <div className="flex items-center justify-between gap-3 border-t border-console-line px-4 py-3">
   <ActionButton size="sm" variant="outline" disabled={current===1} onClick={()=>setPage(v=>Math.max(1,v-1))}
    leadingIcon={<ChevronLeft aria-hidden="true" className="h-4 w-4"/>}>Previous</ActionButton>
   <p className="text-xs text-console-muted">Page {current} of {pages}</p>
   <ActionButton size="sm" variant="outline" disabled={current>=pages} onClick={()=>setPage(v=>Math.min(pages,v+1))}
    trailingIcon={<ChevronRight aria-hidden="true" className="h-4 w-4"/>}>Next</ActionButton>
  </div>
 </Panel>;
}
