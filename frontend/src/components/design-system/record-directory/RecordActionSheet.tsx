"use client";
import Link from "next/link";
import {ChevronRight,Eye} from "lucide-react";
import {AdaptiveSheet} from "@/components/design-system/AdaptiveSheet";
import type {DirectoryRow,DirectoryAction} from "./types";
export function RecordActionSheet({row,actions,onOpen,onClose}:{row:DirectoryRow|null;
 actions:readonly DirectoryAction[];onOpen?:(row:DirectoryRow)=>void;onClose:()=>void}){
 const options=row?actions.filter(a=>a.available?.(row)!==false):[];
 const view=Boolean(row&&(row.href||onOpen));
 return <AdaptiveSheet open={row!==null} onClose={onClose}
  title={row?.title||"Record actions"} description={row?.reference||row?.subtitle}>
  {row?<div className="space-y-2">
   {view?(row.href?<Link href={row.href} onClick={onClose} className="flex min-h-11 items-center gap-3 rounded-lg bg-slate-50 px-3 text-[13px] font-medium text-console-ink hover:bg-blue-50">
    <Eye className="h-4 w-4 text-console-primary" aria-hidden="true"/><span className="flex-1">View record</span><ChevronRight className="h-4 w-4 text-console-muted" aria-hidden="true"/></Link>:
    <button type="button" onClick={()=>{onClose();onOpen?.(row);}} className="flex min-h-11 w-full items-center gap-3 rounded-lg bg-slate-50 px-3 text-left text-[13px] font-medium">
     <Eye className="h-4 w-4 text-console-primary" aria-hidden="true"/>View record</button>):null}
   {options.map(action=>{
    const Icon=action.icon,href=action.href?.(row);
    const content=<><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${action.danger?"bg-rose-50 text-rose-600":"bg-blue-50 text-console-primary"}`}><Icon className="h-4 w-4" aria-hidden="true"/></span><span className="flex-1">{action.label}</span><ChevronRight className="h-4 w-4 text-console-muted" aria-hidden="true"/></>;
    const cls=`flex min-h-11 w-full items-center gap-3 rounded-lg bg-slate-50 px-3 text-left text-[13px] font-medium hover:bg-slate-100 ${action.danger?"text-rose-600":"text-console-ink"}`;
    return href?<Link key={action.key} href={href} onClick={onClose} className={cls}>{content}</Link>:
     action.onSelect?<button key={action.key} type="button" className={cls} onClick={()=>{onClose();action.onSelect?.(row);}}>{content}</button>:null;
   })}
   {!view&&!options.length?<p className="text-sm text-console-muted">No available actions for this record.</p>:null}
   <button type="button" onClick={onClose} className="mt-4 w-full rounded-full border border-console-primary px-4 py-2.5 text-[13px] font-medium text-console-primary">Cancel</button>
  </div>:null}
  </AdaptiveSheet>;
}
