import Link from "next/link";
import {ArrowRight} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {SectionHeading} from "@/components/design-system/SectionHeading";
import {StatusBadge,type StatusTone} from "@/components/design-system/StatusBadge";
import {formatStatus,getStatusTone} from "@/lib/constants/status";
import type {ClientRecord} from "../data/client-demo-data";
export type RecentState="loading"|"ready"|"unavailable";
function tone(status:string):StatusTone{
 const mapped=getStatusTone(status);
 return mapped==="danger"?"error":mapped;
}
export function ClientOverviewRecent({title,description,href,records,state}:{
 title:string;description:string;href:string;records:readonly ClientRecord[];state:RecentState;
}){
 return <Panel>
  <SectionHeading title={title} description={description}
   actions={<Link href={href} className="inline-flex min-h-10 items-center gap-1 rounded-lg text-sm font-semibold text-console-primary hover:underline focus-visible:ring-2 focus-visible:ring-console-primary">
    View all <ArrowRight aria-hidden="true" className="h-4 w-4"/>
   </Link>}/>
  <div className="mt-5 space-y-3" aria-busy={state==="loading"}>
   {state==="loading"?<p role="status" className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-console-muted">Updating your account…</p>:null}
   {state==="unavailable"?<p role="status" className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-console-muted">We couldn't load these details right now.</p>:null}
   {state==="ready"&&records.length===0?<p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-console-muted">Nothing to show here yet.</p>:null}
   {state==="ready"&&records.slice(0,3).map(record=><Link key={record.id} href={record.actionHref}
     className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-console-line bg-slate-50 px-4 py-3 transition-colors hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
     <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold text-console-ink">{record.title}</span>
      <span className="mt-1 block truncate text-xs text-console-muted">{record.subtitle}</span>
     </span>
     <StatusBadge tone={tone(record.status)}>{formatStatus(record.status)}</StatusBadge>
   </Link>)}
  </div>
 </Panel>;
}
