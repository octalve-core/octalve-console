"use client";
import Link from "next/link";
import {MoreVertical} from "lucide-react";
import {DirectoryIcon,DirectoryStatus} from "./RecordVisual";
import type {DirectoryRow} from "./types";
export function MobileRecordCard({row,onOpen,onActions}:{row:DirectoryRow;
 onOpen?:(row:DirectoryRow)=>void;onActions?:(row:DirectoryRow,opener:HTMLElement)=>void}){
 const contents=<>
  <DirectoryIcon row={row}/>
  <span className="min-w-0 flex-1">
   <span className="flex min-w-0 items-baseline justify-between gap-2">
    <span className="min-w-0 truncate text-[13px] font-medium text-console-ink">{row.title}</span>
    {row.amount?<span className="shrink-0 text-[11px] font-medium text-console-ink">{row.amount}</span>:null}
   </span>
   <span className="mt-1 flex min-w-0 items-center justify-between gap-2">
    <span className="min-w-0 truncate rounded-full bg-white px-2 py-1 text-[10px] text-console-muted">{row.reference||row.subtitle||row.id}</span>
    <DirectoryStatus status={row.status}/>
   </span>
   {row.subtitle&&row.subtitle!==row.title&&row.subtitle!==row.reference?
    <span className="mt-1 block truncate text-[11px] text-console-muted">{row.subtitle}</span>:null}
   {row.extra?<span className="mt-1 block">{row.extra}</span>:null}
   {row.date?<span className="mt-1.5 block text-[10px] text-console-muted">{row.dateLabel||"Created"}: {row.date}</span>:null}
  </span>
 </>;
 return <li className="flex min-w-0 items-stretch rounded-xl bg-slate-50 p-2.5 transition-colors hover:bg-slate-100">
  {row.href?<Link href={row.href} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-console-primary" aria-label={"View "+row.title}>{contents}</Link>:
   onOpen?<button type="button" onClick={()=>onOpen(row)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-console-primary">{contents}</button>:
   <div className="flex min-w-0 flex-1 items-center gap-2.5">{contents}</div>}
  {onActions?<button type="button" aria-label={"Actions for "+row.title} aria-haspopup="dialog"
   onClick={event=>onActions(row,event.currentTarget)}
   className="ml-1 grid h-10 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-console-primary">
   <MoreVertical className="h-4 w-4" aria-hidden="true"/></button>:null}
 </li>;
}
