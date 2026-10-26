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
import {formatStatus,getStatusTone} from "@/lib/constants/status";
import type {ClientRecord} from "../data/client-demo-data";

export type ClientEssentialResource="services"|"domains";
const LIMIT=10;
function tone(status:string):StatusTone{
 const mapped=getStatusTone(status);
 return mapped==="danger"?"error":mapped;
}
/** Client-owned records from the configured API; never seed sample rows. */
export function ClientEssentialRecords({resource,records,emptyTitle,emptyDescription}:{
 resource:ClientEssentialResource;records:readonly ClientRecord[];
 emptyTitle:string;emptyDescription:string;
}){
 const [query,setQuery]=useState(""),[status,setStatus]=useState("all"),[page,setPage]=useState(1);
 const statuses=useMemo(()=>Array.from(new Set(records.map(record=>record.status))).sort(),[records]);
 const filtered=useMemo(()=>records.filter(record=>{
  if(status!=="all"&&record.status!==status)return false;
  const needle=query.trim().toLowerCase();
  return !needle||[record.title,record.subtitle,record.meta,record.status,record.id].some(value=>
   value.toLowerCase().includes(needle));
 }),[records,query,status]);
 const totalPages=Math.max(1,Math.ceil(filtered.length/LIMIT));
 const currentPage=Math.min(page,totalPages);
 const visible=filtered.slice((currentPage-1)*LIMIT,currentPage*LIMIT);
 const columns:ResponsiveColumn<ClientRecord>[]=[
  {key:"name",heading:resource==="domains"?"Domain name":"Service",cell:record=><span className="break-words font-semibold text-console-ink">{record.title}</span>},
  {key:"package",heading:resource==="domains"?"Registration":"Package",cell:record=>record.subtitle||"—"},
  {key:"date",heading:resource==="domains"?"Expires":"Next due",cell:record=>record.date||"—"},
  {key:"status",heading:"Status",cell:record=><StatusBadge tone={tone(record.status)}>{formatStatus(record.status)}</StatusBadge>},
  {key:"action",heading:"Details",cell:record=><ActionLink href={record.actionHref} size="sm" variant="outline" className="w-full sm:w-auto">View details</ActionLink>}
 ];
 return <Panel padded={false} className="overflow-hidden">
  <div className="grid min-w-0 gap-3 border-b border-console-line p-4 sm:grid-cols-2 sm:p-5">
   <TextField label={resource==="domains"?"Search domains":"Search services"} type="search"
    value={query} placeholder="Search by name, package or reference"
    startIcon={<Search aria-hidden="true" className="h-4 w-4"/>}
    onChange={event=>{setQuery(event.target.value);setPage(1);}}/>
   <SelectField label="Filter by status" value={status}
    options={[{value:"all",label:"All statuses"},...statuses.map(value=>({value,label:formatStatus(value)}))]}
    onChange={event=>{setStatus(event.target.value);setPage(1);}}/>
  </div>
  <div className="min-w-0 p-4 sm:p-5">
   <p className="mb-3 text-xs text-console-muted">{filtered.length} {resource} found</p>
   <ResponsiveTable caption={"Your "+resource} columns={columns} rows={visible} getRowKey={record=>record.id}
    emptyTitle={filtered.length===0&&records.length>0?"No matching records":emptyTitle}
    emptyDescription={filtered.length===0&&records.length>0?"Try another search or status.":emptyDescription}/>
  </div>
  <div className="flex items-center justify-between gap-3 border-t border-console-line px-4 py-3 sm:px-5">
   <ActionButton size="sm" variant="outline" disabled={currentPage<=1}
    leadingIcon={<ChevronLeft aria-hidden="true" className="h-4 w-4"/>} onClick={()=>setPage(value=>Math.max(1,value-1))}>
    Previous
   </ActionButton>
   <p className="text-xs text-console-muted">Page {currentPage} of {totalPages}</p>
   <ActionButton size="sm" variant="outline" disabled={currentPage>=totalPages}
    trailingIcon={<ChevronRight aria-hidden="true" className="h-4 w-4"/>} onClick={()=>setPage(value=>Math.min(totalPages,value+1))}>
    Next
   </ActionButton>
  </div>
 </Panel>;
}
