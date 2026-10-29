"use client";
import Link from "next/link";
import {MoreVertical} from "lucide-react";
import type {DirectoryColumn,DirectoryRow} from "./types";
import {DirectoryIcon,DirectoryStatus} from "./RecordVisual";
export function DesktopRecordTable({label,rows,columns,onOpen,onActions}:{label:string;
 rows:readonly DirectoryRow[];columns:readonly DirectoryColumn[];
 onOpen?:(row:DirectoryRow)=>void;onActions?:(row:DirectoryRow,opener:HTMLElement)=>void}){
 return <div className="hidden min-w-0 overflow-x-auto px-3 pb-3 lg:block">
  <table className="w-full min-w-[690px] table-fixed border-separate border-spacing-y-1.5 text-left text-[12px] text-console-ink">
   <caption className="sr-only">{label}</caption>
   <thead><tr className="bg-slate-100 text-console-muted">
    <th scope="col" className="w-14 rounded-l-lg px-2 py-2.5 font-medium"><span className="sr-only">Record icon</span></th>
    {columns.map(c=><th key={c.key} scope="col" className={`px-2 py-2.5 font-medium ${c.wideOnly?"hidden xl:table-cell":""}`}>{c.label}</th>)}
    <th scope="col" className="w-28 px-2 py-2.5 font-medium">Status</th>
    {onActions?<th scope="col" className="w-12 rounded-r-lg px-2 py-2.5"><span className="sr-only">Actions</span></th>:null}
   </tr></thead>
   <tbody>{rows.map(row=><tr key={row.id} className="group">
    <td className="rounded-l-lg bg-slate-50 px-2 py-2 group-hover:bg-blue-50/50"><DirectoryIcon row={row}/></td>
    {columns.map((c,i)=><td key={c.key} className={`overflow-hidden bg-slate-50 px-2 py-2.5 group-hover:bg-blue-50/50 ${c.wideOnly?"hidden xl:table-cell":""}`}>
     <div className="min-w-0 break-words">{i===0&&row.href?<Link href={row.href} className="font-medium text-console-primary hover:underline focus-visible:outline-2 focus-visible:outline-console-primary">{c.render(row)}</Link>:
     i===0&&onOpen?<button type="button" onClick={()=>onOpen(row)} className="text-left font-medium text-console-primary hover:underline">{c.render(row)}</button>:c.render(row)}</div>
    </td>)}
    <td className="bg-slate-50 px-2 py-2 group-hover:bg-blue-50/50"><DirectoryStatus status={row.status}/></td>
    {onActions?<td className="rounded-r-lg bg-slate-50 px-2 py-2 group-hover:bg-blue-50/50">
     <button type="button" aria-label={"Actions for "+row.title} aria-haspopup="dialog"
      onClick={e=>onActions(row,e.currentTarget)} className="grid h-9 w-9 place-items-center rounded-lg text-console-muted hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-console-primary">
      <MoreVertical className="h-4 w-4" aria-hidden="true"/></button>
    </td>:null}
   </tr>)}</tbody>
  </table>
 </div>;
}
