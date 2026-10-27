"use client";
import Link from "next/link";
import {ChevronDown,Search} from "lucide-react";
import {useMemo,useState,type ReactNode} from "react";

export type PremiumTableStat={label:string;value:string;helper?:string};
export type PremiumTableFilter={label:string;value:string};
export type PremiumTableColumn<T>={label:string;className?:string;render:(row:T)=>ReactNode};
export type PremiumTableAction<T>={
 label:string;href?:(row:T)=>string;onClick?:(row:T)=>void;tone?:"default"|"danger";
};
export function cleanCurrency(value:string|number|undefined|null){
 return String(value??"").replace(/â‚¦/g,"₦");
}
export function getPremiumStatusTone(status:string){
 const value=status.toLowerCase();
 if(["active","paid","approved","provisioned","ready","synced"].some(x=>value.includes(x)))return "success";
 if(["pending","waiting","unpaid","draft","planned","test"].some(x=>value.includes(x)))return "warning";
 if(["failed","cancelled","suspended","disabled","closed","archived"].some(x=>value.includes(x)))return "danger";
 return "neutral";
}
const statusClasses={
 success:"border-emerald-200 bg-emerald-50 text-emerald-700",
 warning:"border-amber-200 bg-amber-50 text-amber-800",
 danger:"border-rose-200 bg-rose-50 text-rose-700",
 neutral:"border-slate-200 bg-slate-50 text-slate-600"
};
export function PremiumStatusPill({status}:{status:string}){
 return <span className={"inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold capitalize "+statusClasses[getPremiumStatusTone(status)]}>
  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"/>
  <span className="truncate">{status}</span>
 </span>;
}
const linkStyle="inline-flex min-h-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-console-primary hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary";
const dangerStyle="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100";
const defaultStyle="border-console-line bg-white text-console-ink hover:bg-slate-50";
export function AdminPremiumTable<T>({
 title,description,rows,rowKey,columns,stats=[],filters=[{label:"All",value:"all"}],
 filterValue,searchPlaceholder="Search records...",searchText,primaryAction,rowActions=[],
 emptyTitle="No records found",emptyDescription="Try changing your search or filter."
}:{
 title:string;description?:string;rows:T[];rowKey:(row:T)=>string;columns:PremiumTableColumn<T>[];
 stats?:PremiumTableStat[];filters?:PremiumTableFilter[];filterValue?:(row:T)=>string;
 searchPlaceholder?:string;searchText:(row:T)=>string;
 primaryAction?:{label:string;href:(row:T)=>string};
 rowActions?:PremiumTableAction<T>[];emptyTitle?:string;emptyDescription?:string;
}){
 const [query,setQuery]=useState(""),[activeFilter,setActiveFilter]=useState(filters[0]?.value??"all");
 const [openRowKey,setOpenRowKey]=useState<string|null>(null);
 const visibleRows=useMemo(()=>{
  const value=query.trim().toLowerCase();
  return rows.filter(row=>(!value||searchText(row).toLowerCase().includes(value))&&
   (activeFilter==="all"||(filterValue?filterValue(row):"all")===activeFilter));
 },[activeFilter,filterValue,query,rows,searchText]);
 function rowActionsView(row:T,mobile:boolean){
  const id=rowKey(row);
  return <div className="flex flex-wrap items-center gap-2">
   {primaryAction?<Link href={primaryAction.href(row)} className={linkStyle}>{primaryAction.label}</Link>:null}
   {rowActions.length>0?(mobile?
    rowActions.map(action=>action.href?
     <Link key={action.label} href={action.href(row)} className={"inline-flex min-h-10 items-center rounded-lg border px-3 text-xs font-semibold "+(action.tone==="danger"?dangerStyle:defaultStyle)}>
      {action.label}</Link>:
     <button key={action.label} type="button" onClick={()=>action.onClick?.(row)}
      className={"min-h-10 rounded-lg border px-3 text-xs font-semibold "+(action.tone==="danger"?dangerStyle:defaultStyle)}>
      {action.label}</button>):
    <div className="relative">
     <button type="button" aria-label={"Actions for "+id} aria-expanded={openRowKey===id}
      aria-haspopup="menu" onClick={()=>setOpenRowKey(current=>current===id?null:id)}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-console-line text-console-ink hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-console-primary">
      <ChevronDown aria-hidden="true" className="h-4 w-4"/></button>
     {openRowKey===id?<div role="menu" className="absolute right-0 top-11 z-20 min-w-40 overflow-hidden rounded-xl border border-console-line bg-white p-1 shadow-xl">
      {rowActions.map(action=>action.href?
       <Link role="menuitem" key={action.label} href={action.href(row)} onClick={()=>setOpenRowKey(null)}
        className={"block rounded-lg px-3 py-2 text-sm hover:bg-slate-50 "+(action.tone==="danger"?"text-rose-700":"text-console-ink")}>
        {action.label}</Link>:
       <button role="menuitem" key={action.label} type="button"
        onClick={()=>{action.onClick?.(row);setOpenRowKey(null);}}
        className={"block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 "+(action.tone==="danger"?"text-rose-700":"text-console-ink")}>
        {action.label}</button>)}
     </div>:null}
    </div>
   ):null}
  </div>;
 }
 return <section className="min-w-0 space-y-5">
  {stats.length>0?<div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
   {stats.map(stat=><article key={stat.label} className="min-w-0 rounded-2xl border border-console-line bg-white p-5">
    <p className="text-xs font-medium text-console-muted">{stat.label}</p>
    <p className="mt-2 break-words text-2xl font-semibold text-console-ink">{stat.value}</p>
    {stat.helper?<p className="mt-2 text-xs leading-5 text-console-muted">{stat.helper}</p>:null}
   </article>)}
  </div>:null}
  <div className="min-w-0 rounded-2xl border border-console-line bg-white shadow-sm">
   <div className="flex min-w-0 flex-col justify-between gap-4 border-b border-console-line p-4 lg:flex-row lg:items-center sm:p-5">
    <div className="min-w-0">
     <h2 className="break-words text-lg font-semibold text-console-ink">{title}</h2>
     {description?<p className="mt-1 text-sm leading-6 text-console-muted">{description}</p>:null}
    </div>
    <label className="flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl border border-console-line px-3 focus-within:border-console-primary focus-within:ring-2 focus-within:ring-blue-100 lg:max-w-xs">
     <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-console-muted"/>
     <span className="sr-only">Search {title}</span>
     <input type="search" value={query} onChange={event=>setQuery(event.target.value)}
      placeholder={searchPlaceholder} className="h-11 min-w-0 flex-1 bg-transparent text-base text-console-ink outline-none placeholder:text-slate-400"/>
    </label>
   </div>
   <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-console-line px-4 py-3 sm:px-5">
    <div aria-label="Filter records" className="flex min-w-0 flex-wrap gap-2">
     {filters.map(filter=><button key={filter.value} type="button" aria-pressed={activeFilter===filter.value}
      onClick={()=>{setActiveFilter(filter.value);setOpenRowKey(null);}}
      className={activeFilter===filter.value?
       "min-h-10 rounded-lg bg-console-primary px-3 text-xs font-semibold text-white":
       "min-h-10 rounded-lg border border-console-line bg-white px-3 text-xs font-semibold text-console-muted hover:bg-blue-50"}>
      {filter.label}</button>)}
    </div>
    <p className="text-xs text-console-muted">{visibleRows.length} result{visibleRows.length===1?"":"s"}</p>
   </div>
   {visibleRows.length===0?<div className="p-8 text-center">
    <p className="text-base font-semibold text-console-ink">{emptyTitle}</p>
    <p className="mt-2 text-sm text-console-muted">{emptyDescription}</p>
   </div>:<>
    <div className="hidden w-full overflow-x-auto lg:block">
     <table className="w-full min-w-[780px] border-collapse text-left text-sm">
      <caption className="sr-only">{title}</caption>
      <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-console-muted">
       <tr>{columns.map(column=><th key={column.label} scope="col" className={"px-4 py-3 "+(column.className??"")}>{column.label}</th>)}
        <th scope="col" className="px-4 py-3">Actions</th></tr>
      </thead>
      <tbody className="divide-y divide-console-line">
       {visibleRows.map(row=><tr key={rowKey(row)} className="align-top hover:bg-slate-50/70">
        {columns.map(column=><td key={column.label} className={"max-w-72 px-4 py-4 text-console-ink "+(column.className??"")}>
         {column.render(row)}</td>)}
        <td className="px-4 py-4">{rowActionsView(row,false)}</td>
       </tr>)}
      </tbody>
     </table>
    </div>
    <ul aria-label={title+" mobile records"} className="divide-y divide-console-line lg:hidden">
     {visibleRows.map(row=><li key={rowKey(row)} className="min-w-0 space-y-4 px-4 py-5">
      {columns.map((column,index)=><div key={column.label} className={index===0?
       "min-w-0 border-b border-console-line pb-3":
       "grid min-w-0 grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-start gap-3"}>
       <p className="text-xs font-semibold text-console-muted">{column.label}</p>
       <div className={index===0?"mt-2 break-words text-sm font-semibold text-console-ink":"min-w-0 break-words text-sm text-console-ink"}>
        {column.render(row)}</div>
      </div>)}
      {(primaryAction||rowActions.length>0)?<div className="border-t border-console-line pt-4">{rowActionsView(row,true)}</div>:null}
     </li>)}
    </ul>
   </>}
  </div>
 </section>;
}
