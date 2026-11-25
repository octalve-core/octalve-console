"use client";
import Link from "next/link";
import {MoreVertical} from "lucide-react";
import {DirectoryIcon,DirectoryStatus} from "./RecordVisual";
import type {DirectoryRow} from "./types";

const target="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-console-primary";
const dateText="min-w-0 truncate text-[10px] text-console-muted";

export function MobileRecordCard({row,onOpen,onActions}:{row:DirectoryRow;
 onOpen?:(row:DirectoryRow)=>void;onActions?:(row:DirectoryRow,opener:HTMLElement)=>void}){
 const reference=row.reference||row.subtitle||row.id;
 const date=row.date?`${row.dateLabel||"Created"}: ${row.date}`:"";
 const secondary=row.secondaryDate?`${row.secondaryDateLabel||"Due"}: ${row.secondaryDate}`:"";
 const [leftDate,rightDate]=row.secondaryDateLabel==="Issued"?[secondary,date]:[date,secondary];
 const contents=<>
  <DirectoryIcon row={row}/>
  <span className="min-w-0 flex-1">
   <span className="grid min-w-0 grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] grid-rows-[1.25rem_1.5rem_1.125rem] items-center gap-x-2 gap-y-0.5">
    <span title={row.title} className="min-w-0 truncate text-[12px] font-medium text-console-ink">{row.title}</span>
    <span title={row.amount} aria-label={row.amountLabel&&row.amount?row.amountLabel+": "+row.amount:undefined} className="min-w-0 truncate text-right text-[11px] font-medium tabular-nums text-console-ink">{row.amount}</span>
    <span title={reference} className="w-fit min-w-0 max-w-full truncate rounded-full bg-white px-2 py-1 text-[10px] text-console-muted">{reference}</span>
    <span className="flex min-w-0 justify-end overflow-hidden"><DirectoryStatus status={row.status}/></span>
    <span title={leftDate} className={dateText}>{leftDate}</span>
    <span title={rightDate} className={dateText+" text-right"}>{rightDate}</span>
   </span>
   {row.subtitle&&row.subtitle!==row.title&&row.subtitle!==reference?<span title={row.subtitle} className="mt-1 block truncate text-[11px] text-console-muted">{row.subtitle}</span>:null}
   {row.extra?<span className="mt-1 block min-w-0">{row.extra}</span>:null}
  </span>
 </>;
 return <li className="flex min-w-0 items-center rounded-2xl bg-slate-50 p-2.5 transition-colors hover:bg-slate-100">
  {row.href?<Link href={row.href} className={target}>{contents}</Link>:
   onOpen?<button type="button" onClick={()=>onOpen(row)} className={target}>{contents}</button>:
   <div className={target}>{contents}</div>}
  {onActions?<button type="button" aria-label={"Actions for "+row.title} aria-haspopup="dialog"
   onClick={event=>onActions(row,event.currentTarget)}
   className="ml-1 grid h-11 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-console-primary">
   <MoreVertical className="h-4 w-4" aria-hidden="true"/></button>:null}
 </li>;
}
