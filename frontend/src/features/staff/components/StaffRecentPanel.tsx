import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {StatusBadge,type StatusTone} from "@/components/design-system/StatusBadge";
import {formatStatus,getStatusTone} from "@/lib/constants/status";
import type {StaffRecord} from "../data/staff-demo-data";
function tone(status:string):StatusTone{const t=getStatusTone(status);return t==="danger"?"error":t;}
export function StaffRecentPanel({title,description,href,records,state}:{
 title:string;description:string;href:string;records:readonly StaffRecord[];
 state:"loading"|"ready"|"unavailable";
}){
 return <Panel>
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="text-lg font-medium text-console-ink">{title}</h2>
    <p className="mt-1 text-sm leading-6 text-console-muted">{description}</p></div>
   <Link href={href} className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-console-primary hover:underline focus-visible:ring-2 focus-visible:ring-console-primary">
    View all <ArrowRight aria-hidden="true" className="h-4 w-4"/>
   </Link>
  </div>
  <div className="mt-5 space-y-3" aria-busy={state==="loading"}>
   {state==="loading"?<p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-console-muted">Updating your records…</p>:null}
   {state==="unavailable"?<p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-console-muted">These details are temporarily unavailable.</p>:null}
   {state==="ready"&&records.length===0?<p className="rounded-xl bg-slate-50 p-4 text-sm text-console-muted">No records to show yet.</p>:null}
   {state==="ready"&&records.slice(0,3).map(record=><Link href={record.actionHref} key={record.id}
    className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-console-line bg-slate-50 px-4 py-3 hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
    <span className="min-w-0 flex-1">
     <span className="block truncate text-sm font-medium text-console-ink">{record.title}</span>
     <span className="mt-1 block truncate text-xs text-console-muted">{record.subtitle}</span>
    </span>
    <StatusBadge tone={tone(record.status)}>{formatStatus(record.status)}</StatusBadge>
   </Link>)}
  </div>
 </Panel>;
}
