import Link from "next/link";
import {ArrowRight,Server,Ticket} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {MobileRecordCard} from "@/components/design-system/record-directory/MobileRecordCard";

import type {StaffRecord} from "../data/staff-demo-data";

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
   {state==="ready"&&records.length>0&&<ul className="space-y-2">
    {records.slice(0,3).map(record=>{
     const Icon=href==="/staff/tickets"?Ticket:Server;
     return <MobileRecordCard key={record.id} row={{id:record.id,title:record.title,
      reference:record.meta!=="—"?record.meta:record.id,status:record.status,
      href:record.actionHref,date:record.date?record.date.slice(0,10):undefined,
      icon:<Icon className="size-5"/>}}/>;
    })}
   </ul>}
  </div>
 </Panel>;
}
