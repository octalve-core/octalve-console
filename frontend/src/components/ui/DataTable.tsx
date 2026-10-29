import Link from "next/link";
import type {ReactNode} from "react";
import {Badge} from "./Badge";
import type {StatusTone} from "@/lib/platform-data";

export type Column={header:string;accessor:string};
export type Row=Record<string,any>&{
 id?:string;status?:string;href?:string;editHref?:string;manageHref?:string;tone?:StatusTone;
};
type Props={title:string;subtitle?:string;columns:Column[];rows:Row[];action?:ReactNode};
type Color="success"|"warning"|"danger"|"neutral";
function statusTone(status:string):Color{
 const value=status.toLowerCase();
 if(["active","paid","approved","provisioned","ready"].some(w=>value.includes(w)))return "success";
 if(["pending","test","waiting","planned","unpaid"].some(w=>value.includes(w)))return "warning";
 if(["failed","suspended","cancelled","disabled","error"].some(w=>value.includes(w)))return "danger";
 return "neutral";
}
function displayedTone(tone:StatusTone|undefined,status:string):Color{
 if(tone==="green")return "success";
 if(tone==="orange")return "warning";
 if(tone==="red")return "danger";
 return statusTone(status);
}
function RowActions({row}:{row:Row}){
 const entries=[{href:row.href,label:"Open"},{href:row.editHref,label:"Edit"},{href:row.manageHref,label:"Manage"}].filter(
  (entry):entry is {href:string;label:string}=>typeof entry.href==="string"&&entry.href.length>0
 );
 if(!entries.length)return <span className="text-xs text-console-muted">—</span>;
 return <div className="flex min-w-0 flex-wrap gap-2">
  {entries.map(entry=><Link href={entry.href} key={entry.label}
   className="inline-flex min-h-10 items-center rounded-lg border border-console-line bg-white px-3 text-xs font-medium text-console-primary hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
   {entry.label}</Link>)}
 </div>;
}
function Value({row,column}:{row:Row;column:Column}){
 const value=row[column.accessor];
 if(column.accessor==="status")return <Badge variant={displayedTone(row.tone,String(value??""))}>{String(value??"Unknown")}</Badge>;
 if(column.accessor==="id"&&row.href)return <Link href={row.href}
  className="break-all font-medium text-console-primary hover:underline">{String(value??"—")}</Link>;
 if(value===null||value===undefined||value==="")return <>—</>;
 return <span className="break-words">{value as ReactNode}</span>;
}
/** Responsive data presentation only. Record ownership and navigation stay with callers. */
export function DataTable({title,subtitle,columns,rows,action}:Props){
 return <section className="min-w-0 overflow-hidden rounded-2xl border border-console-line bg-white shadow-sm">
  <header className="flex min-w-0 flex-col gap-3 border-b border-console-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
   <div className="min-w-0">
    <h2 className="break-words text-lg font-medium text-console-ink">{title}</h2>
    {subtitle?<p className="mt-1 text-sm leading-6 text-console-muted">{subtitle}</p>:null}
   </div>
   {action?<div className="flex flex-wrap gap-2">{action}</div>:null}
  </header>
  {rows.length===0?<div className="p-8 text-center text-sm text-console-muted">No records to display.</div>:<>
   <ul aria-label={title+" records"} className="divide-y divide-console-line md:hidden">
    {rows.map((row,index)=><li key={row.id||index} className="min-w-0 space-y-3 p-4">
     {columns.map(column=><div key={column.accessor} className="grid min-w-0 grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-start gap-3">
      <span className="text-xs font-medium text-console-muted">{column.header}</span>
      <div className="min-w-0 text-sm text-console-ink"><Value row={row} column={column}/></div>
     </div>)}
     <RowActions row={row}/>
    </li>)}
   </ul>
   <div className="hidden w-full overflow-x-auto md:block">
    <table className="w-full min-w-[680px] border-collapse text-left text-sm">
     <caption className="sr-only">{title}</caption>
     <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-console-muted">
      <tr>{columns.map(column=><th key={column.accessor} scope="col" className="px-4 py-3">{column.header}</th>)}
       <th scope="col" className="px-4 py-3">Actions</th></tr>
     </thead>
     <tbody className="divide-y divide-console-line">
      {rows.map((row,index)=><tr key={row.id||index} className="align-top hover:bg-slate-50/60">
       {columns.map(column=><td key={column.accessor} className="max-w-64 px-4 py-4 text-console-ink">
        <Value row={row} column={column}/></td>)}
       <td className="px-4 py-4"><RowActions row={row}/></td>
      </tr>)}
     </tbody>
    </table>
   </div>
  </>}
 </section>;
}
