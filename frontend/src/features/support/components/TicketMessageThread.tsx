import {Headphones,UserRound} from "lucide-react";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import type {TicketDetail} from "@/lib/api/modules/help-center.api";
export function TicketMessageThread({ticket}: {ticket:TicketDetail}){
 return <div className="mt-6 space-y-6">
  <div className="flex flex-wrap items-center gap-2 border-b border-console-line pb-5">
   <span className="text-sm font-medium text-console-primary">{ticket.ticket_number}</span>
   <StatusBadge tone={ticket.status==="closed"||ticket.status==="resolved"?"success":"info"}>
    {ticket.status.replaceAll("_"," ")}
   </StatusBadge>
   <span className="text-xs text-console-muted">{ticket.department_name}</span>
  </div>
  <ol aria-label="Ticket messages" className="space-y-5">
   {ticket.messages.map(item=>{
    const agent=item.sender_role!=="client";
    return <li key={item.id} className={agent?"flex min-w-0 gap-3":"flex min-w-0 flex-row-reverse gap-3"}>
     <span aria-hidden="true" className={agent?
      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-console-primary":
      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-console-ink"}>
      {agent?<Headphones className="h-4 w-4"/>:<UserRound className="h-4 w-4"/>}
     </span>
     <div className={agent?"min-w-0 max-w-[85%] rounded-2xl bg-blue-50/70 p-4":
      "min-w-0 max-w-[85%] rounded-2xl bg-slate-50 p-4"}>
      <div className="flex flex-wrap items-center gap-2">
       <span className="text-xs font-medium text-console-ink">{item.sender_name_display||item.sender_role}</span>
       {item.is_internal?<StatusBadge tone="warning">Internal note</StatusBadge>:null}
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-console-ink">{item.message}</p>
      <time dateTime={item.created_at} className="mt-2 block text-xs text-console-muted">{new Date(item.created_at).toLocaleString()}</time>
     </div>
    </li>;
   })}
  </ol>
 </div>;
}
