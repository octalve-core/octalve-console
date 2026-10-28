"use client";
import {useMemo,useState} from "react";
import {ChevronLeft,ChevronRight,Search} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {TextField} from "@/components/design-system/TextField";
import {SelectField} from "@/components/design-system/SelectField";
import {ActionButton} from "@/components/design-system/ActionButton";
import {ResponsiveTable,type ResponsiveColumn} from "@/components/design-system/ResponsiveTable";
import {StatusBadge,type StatusTone} from "@/components/design-system/StatusBadge";
import {formatStatus,getStatusTone} from "@/lib/constants/status";
import type {StaffRecord,StaffResourceKey} from "../data/staff-demo-data";
type OperationalResource=Extract<StaffResourceKey,"customers"|"orders"|"provisioning">;
const PAGE_SIZE=10;
function tone(status:string):StatusTone{const x=getStatusTone(status);return x==="danger"?"error":x;}
export function StaffOperationalDirectory({resource,records,emptyTitle,emptyDescription}:{
 resource:OperationalResource;records:readonly StaffRecord[];emptyTitle:string;emptyDescription:string;
}){
 const [search,setSearch]=useState(""),[status,setStatus]=useState("all"),[page,setPage]=useState(1);
 const statuses=useMemo(()=>[...new Set(records.map(r=>r.status))].sort(),[records]);
 const filtered=useMemo(()=>records.filter(r=>{
  if(status!=="all"&&r.status!==status)return false;
  const needle=search.trim().toLowerCase();
  return !needle||[r.id,r.title,r.subtitle,r.meta,r.status,r.date??""].some(x=>x.toLowerCase().includes(needle));
 }),[records,search,status]);
 const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const current=Math.min(page,totalPages),visible=filtered.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE);
 const columns:ResponsiveColumn<StaffRecord>[]=[
  {key:"name",heading:resource==="customers"?"Customer":resource==="orders"?"Order":"Task",
   cell:r=><span className="break-words font-semibold text-console-ink">{r.title}</span>},
  {key:"context",heading:resource==="customers"?"Account":resource==="orders"?"Details":"Provisioning details",
   cell:r=><span className="break-words">{r.subtitle}</span>},
  {key:"reference",heading:"Reference / category",cell:r=><span className="break-words text-console-primary">{r.meta}</span>},
  {key:"date",heading:"Last updated",cell:r=>r.date||"—"},
  {key:"status",heading:"Status",cell:r=><StatusBadge tone={tone(r.status)}>{formatStatus(r.status)}</StatusBadge>}
 ];
 return <Panel padded={false} className="overflow-hidden">
  <WorkspaceGrid variant="filters" className="border-b border-console-line p-4 sm:p-5">
   <TextField label={"Search "+resource} type="search" value={search} placeholder="Search records"
    startIcon={<Search aria-hidden="true" className="h-4 w-4"/>}
    onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
   <SelectField label="Status" value={status}
    options={[{value:"all",label:"All statuses"},...statuses.map(s=>({value:s,label:formatStatus(s)}))]}
    onChange={e=>{setStatus(e.target.value);setPage(1);}}/>
  </WorkspaceGrid>
  <div className="min-w-0 p-4 sm:p-5">
   <p className="mb-3 text-xs text-console-muted">{filtered.length} {resource} found</p>
   <ResponsiveTable caption={"Staff "+resource} columns={columns} rows={visible}
    getRowKey={r=>r.id}
    emptyTitle={filtered.length===0&&records.length>0?"No matching records":emptyTitle}
    emptyDescription={filtered.length===0&&records.length>0?"Try another search or status.":emptyDescription}/>
  </div>
  <div className="flex items-center justify-between gap-3 border-t border-console-line px-4 py-3 sm:px-5">
   <ActionButton size="sm" variant="outline" disabled={current===1}
    onClick={()=>setPage(v=>Math.max(1,v-1))}
    leadingIcon={<ChevronLeft aria-hidden="true" className="h-4 w-4"/>}>Previous</ActionButton>
   <p className="text-xs text-console-muted">Page {current} of {totalPages}</p>
   <ActionButton size="sm" variant="outline" disabled={current===totalPages}
    onClick={()=>setPage(v=>Math.min(totalPages,v+1))}
    trailingIcon={<ChevronRight aria-hidden="true" className="h-4 w-4"/>}>Next</ActionButton>
  </div>
 </Panel>;
}
