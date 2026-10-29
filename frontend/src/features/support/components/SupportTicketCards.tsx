import Link from "next/link";
import {ArrowRight,LifeBuoy} from "lucide-react";
import {EmptyState} from "@/components/design-system/EmptyState";
import {StatusBadge,type StatusTone} from "@/components/design-system/StatusBadge";
import type {TicketDetail} from "@/lib/api/modules/help-center.api";
export type TicketAudience="client"|"staff"|"admin";
function tone(status:string):StatusTone{
 if(status==="resolved"||status==="closed")return "success";
 if(status==="waiting_staff"||status==="on_hold")return "warning";
 return "info";
}
export function SupportTicketCards({role,tickets,emptyTitle="No tickets in this view",emptyDescription="Your requests will appear here."}:{
 role:TicketAudience;tickets:readonly TicketDetail[];emptyTitle?:string;emptyDescription?:string;
}){
 if(!tickets.length)return <EmptyState icon={LifeBuoy} title={emptyTitle} description={emptyDescription}/>;
 return <ul aria-label="Support requests" className="space-y-3">
  {tickets.map(ticket=>{
   const target=role==="staff"?"/staff/tickets":role==="admin"?"/admin/support":"/client/support";
   return <li key={ticket.id}>
    <Link href={target+"/"+encodeURIComponent(String(ticket.id))}
     className="group flex min-w-0 flex-col gap-3 rounded-2xl border border-console-line bg-white px-4 py-5 transition-colors hover:border-blue-200 hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary sm:flex-row sm:items-center sm:justify-between sm:px-5">
     <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-xs text-console-muted">
       <span className="font-medium text-console-primary">{ticket.ticket_number}</span>
       <span className="rounded-full bg-slate-100 px-2 py-0.5">{ticket.department_name}</span>
       {role!=="client"?<span className="capitalize">{ticket.priority}</span>:null}
      </div>
      <h3 className="mt-2 break-words text-sm font-medium text-console-ink sm:text-base">{ticket.subject}</h3>
      {role!=="client"?<p className="mt-1 text-xs text-console-muted">{ticket.client_name} · {ticket.assigned_to_name||"Department queue"}</p>:null}
     </div>
     <div className="flex shrink-0 items-center justify-between gap-3">
      <StatusBadge tone={tone(ticket.status)}>{ticket.status.replaceAll("_"," ")}</StatusBadge>
      <ArrowRight aria-hidden="true" className="h-4 w-4 text-console-muted group-hover:text-console-primary"/>
     </div>
    </Link>
   </li>;
  })}
 </ul>;
}
