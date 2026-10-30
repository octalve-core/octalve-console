"use client";
import {useMemo,useState} from "react";
import {DirectoryToolbar} from "./DirectoryToolbar";
import {DirectoryPagination} from "./DirectoryPagination";
import {DirectoryFilterSheet} from "./DirectoryFilterSheet";
import {StatusTabs} from "./StatusTabs";
import {DesktopRecordTable} from "./DesktopRecordTable";
import {MobileRecordCard} from "./MobileRecordCard";
import {RecordActionSheet} from "./RecordActionSheet";
import type {DirectoryAction,DirectoryColumn,DirectoryCreate,DirectoryFilter,DirectoryRow} from "./types";
const emptyFilter:DirectoryFilter={status:"all",category:"all",from:"",to:""};
const PAGE_SIZE=10;
/** A single owner for client-side presentation of an already-authorized API page.
 * This does not claim that a partial paginated API response is a complete collection.
 */
export function RecordDirectory({label,rows,columns,actions=[],onOpen,create,emptyMessage="No records found.",
 onExport}:{label:string;rows:readonly DirectoryRow[];columns:readonly DirectoryColumn[];
 actions?:readonly DirectoryAction[];onOpen?:(row:DirectoryRow)=>void;create?:DirectoryCreate;
 emptyMessage?:string;onExport?:()=>void}){
 const [search,setSearch]=useState(""),[status,setStatus]=useState("all");
 const [filter,setFilter]=useState<DirectoryFilter>(emptyFilter),[page,setPage]=useState(1);
 const [filterOpen,setFilterOpen]=useState(false),[selected,setSelected]=useState<DirectoryRow|null>(null);
 const statuses=useMemo(()=>[...new Set(rows.map(r=>r.status))].sort(),[rows]);
 const categories=useMemo(()=>[...new Set(rows.map(r=>r.category).filter((x):x is string=>Boolean(x)))].sort(),[rows]);
 const filtered=useMemo(()=>rows.filter(r=>{
  if(status!=="all"&&r.status!==status)return false;
  if(filter.status!=="all"&&r.status!==filter.status)return false;
  if(filter.category!=="all"&&r.category!==filter.category)return false;
  const date=r.dateISO||(r.date&&/^\d{4}-\d{2}-\d{2}/.test(r.date)?r.date.slice(0,10):"");
  if((filter.from||filter.to)&&(!date||(filter.from&&date<filter.from)||(filter.to&&date>filter.to)))return false;
  const q=search.trim().toLowerCase();
  return !q||[r.id,r.title,r.subtitle,r.reference,r.amount,r.category,r.status,...(r.searchTerms||[])]
   .some(x=>x?.toLowerCase().includes(q));
 }),[rows,status,filter,search]);
 const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const current=Math.min(page,pages),visible=filtered.slice((current-1)*PAGE_SIZE,current*PAGE_SIZE);
 const selectedActions=selected?actions.filter(a=>a.available?.(selected)!==false):[];
 const showActions=Boolean(onOpen||rows.some(row=>Boolean(row.href))||actions.length);
 function chooseStatus(s:string){setStatus(s);setPage(1);}
 return <section aria-label={label} className="min-w-0 overflow-hidden rounded-2xl border border-console-line bg-white shadow-[0_2px_12px_rgba(0,25,62,0.035)]">
  <StatusTabs label={label} items={statuses} value={status} onChange={chooseStatus}/>
  <DirectoryToolbar label={label} count={filtered.length} query={search}
   onQuery={v=>{setSearch(v);setPage(1);}} onFilters={()=>setFilterOpen(true)} create={create} onExport={onExport}/>
  {visible.length?<><DesktopRecordTable label={label} rows={visible} columns={columns} onOpen={onOpen}
    onActions={showActions?(row)=>setSelected(row):undefined}/>
   <ul aria-label={label+" mobile records"} className="space-y-2 p-2.5 lg:hidden">
    {visible.map(row=><MobileRecordCard key={row.id} row={row} onOpen={onOpen}
     onActions={showActions?row=>setSelected(row):undefined}/>)}
   </ul></>:<p className="px-4 py-10 text-center text-[13px] text-console-muted">
    {rows.length&&!filtered.length?"No matching records. Try another search or filter.":emptyMessage}
   </p>}
  <DirectoryPagination page={current} pages={pages} onPage={setPage}/>
  <DirectoryFilterSheet open={filterOpen} onClose={()=>setFilterOpen(false)} initial={filter}
   statuses={statuses} categories={categories} onApply={v=>{setFilter(v);setPage(1);}}/>
  <RecordActionSheet row={selected} actions={selectedActions} onOpen={onOpen}
   onClose={()=>setSelected(null)}/>
 </section>;
}
