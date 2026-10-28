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
export type AdminDirectoryRecord={id:string;title:string;subtitle:string;meta:string;status:string;date?:string;amount?:string;actionHref:string};
const PAGE_SIZE=10;
function tone(status:string):StatusTone{const v=getStatusTone(status);return v==="danger"?"error":v;}
export function AdminGenericDirectory({label,records,emptyTitle,emptyDescription,allowDetails=true}:{
 label:string;records:readonly AdminDirectoryRecord[];emptyTitle:string;emptyDescription:string;allowDetails?:boolean;
}){
 const [query,setQuery]=useState(""),[status,setStatus]=useState("all"),[page,setPage]=useState(1);
 const statuses=useMemo(()=>[...new Set(records.map(item=>item.status))].sort(),[records]);
 const matches=useMemo(()=>records.filter(item=>{
  if(status!=="all"&&item.status!==status)return false;
  const value=query.trim().toLowerCase();
  return !value||[item.id,item.title,item.subtitle,item.meta,item.status,item.amount??"",item.date??""].some(text=>text.toLowerCase().includes(value));
 }),[records,query,status]);
 const totalPages=Math.max(1,Math.ceil(matches.length/PAGE_SIZE)),current=Math.min(page,totalPages);
 const rows=matches.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE);
 const columns:ResponsiveColumn<AdminDirectoryRecord>[]=[
  {key:"record",heading:"Record",cell:item=><span className="break-words font-semibold text-console-ink">{item.title}</span>},
  {key:"details",heading:"Details",cell:item=>item.subtitle||"—"},
  {key:"reference",heading:"Reference",cell:item=><span className="break-words text-console-primary">{item.meta||item.id}</span>},
  {key:"amount",heading:"Amount",cell:item=>item.amount||"—"},
  {key:"date",heading:"Updated",cell:item=>item.date||"—"},
  {key:"status",heading:"Status",cell:item=><StatusBadge tone={tone(item.status)}>{formatStatus(item.status)}</StatusBadge>},
  ...(allowDetails?[{key:"action",heading:"Details",cell:(item:AdminDirectoryRecord)=><ActionLink
   href={item.actionHref} size="sm" variant="outline" className="w-full sm:w-auto">View</ActionLink>}]:[])
 ];
 return <Panel padded={false} className="overflow-hidden">
  <WorkspaceGrid variant="filters" className="border-b border-console-line p-4 sm:p-5">
   <TextField label={"Search "+label} value={query} type="search" placeholder="Search records"
    startIcon={<Search aria-hidden="true" className="h-4 w-4"/>}
    onChange={event=>{setQuery(event.target.value);setPage(1);}}/>
   <SelectField label="Status" value={status} options={[{value:"all",label:"All statuses"},
    ...statuses.map(value=>({value,label:formatStatus(value)}))]}
    onChange={event=>{setStatus(event.target.value);setPage(1);}}/>
  </WorkspaceGrid>
  <div className="min-w-0 p-4 sm:p-5">
   <p className="mb-3 text-xs text-console-muted">{matches.length} results</p>
   <ResponsiveTable caption={label} columns={columns} rows={rows} getRowKey={item=>item.id}
    emptyTitle={matches.length===0&&records.length>0?"No matching records":emptyTitle}
    emptyDescription={matches.length===0&&records.length>0?"Try another search or filter.":emptyDescription}/>
  </div>
  <div className="flex items-center justify-between gap-3 border-t border-console-line px-4 py-3 sm:px-5">
   <ActionButton size="sm" variant="outline" disabled={current===1}
    leadingIcon={<ChevronLeft aria-hidden="true" className="h-4 w-4"/>}
    onClick={()=>setPage(n=>Math.max(1,n-1))}>Previous</ActionButton>
   <p className="text-xs text-console-muted">Page {current} of {totalPages}</p>
   <ActionButton size="sm" variant="outline" disabled={current===totalPages}
    trailingIcon={<ChevronRight aria-hidden="true" className="h-4 w-4"/>}
    onClick={()=>setPage(n=>Math.min(totalPages,n+1))}>Next</ActionButton>
  </div>
 </Panel>;
}
