"use client";
import {MessageCircle,Settings2,ShieldCheck} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {SelectField} from "@/components/design-system/SelectField";
import {ActionButton} from "@/components/design-system/ActionButton";
import type {SupportAgent,TicketDetail} from "@/lib/api/modules/help-center.api";
export function TicketContextPanels({ticket,role,eligibleAgents,busy,onAction,onAssign}:{
 ticket:TicketDetail|null;role:"client"|"staff"|"admin";eligibleAgents:readonly SupportAgent[];
 busy:boolean;onAction:(name:string)=>void;onAssign:(staffId:number)=>void;
}){
 if(!ticket)return null;
 return <aside className="h-fit min-w-0 space-y-4 xl:col-span-1">
  <Panel>
   <h3 className="flex items-center gap-2 text-base font-medium text-console-ink">
    <ShieldCheck aria-hidden="true" className="h-5 w-5 text-console-primary"/>Ticket details
   </h3>
   <dl className="mt-4 space-y-3 text-sm">
    <div><dt className="text-console-muted">Team</dt><dd className="mt-1 font-medium text-console-ink">{ticket.department_name}</dd></div>
    <div><dt className="text-console-muted">Assigned specialist</dt><dd className="mt-1 font-medium text-console-ink">{ticket.assigned_to_name||"Department queue"}</dd></div>
    <div><dt className="text-console-muted">Priority</dt><dd className="mt-1 font-medium capitalize text-console-ink">{ticket.priority}</dd></div>
   </dl>
  </Panel>
  {role==="admin"?<Panel>
   <h3 className="flex items-center gap-2 text-sm font-medium text-console-ink">
    <Settings2 aria-hidden="true" className="h-4 w-4 text-console-primary"/>Manage assignment
   </h3>
   <p className="mt-2 text-xs leading-5 text-console-muted">Only eligible department specialists can be assigned.</p>
   <div className="mt-4">
    <SelectField label="Assign support specialist" value={ticket.assigned_to?String(ticket.assigned_to):""}
     disabled={busy} placeholder="Department queue"
     options={eligibleAgents.map(agent=>({value:String(agent.id),label:agent.full_name||"Agent #"+agent.id}))}
     onChange={event=>{const id=Number(event.target.value);if(id)onAssign(id);}}/>
   </div>
  </Panel>:null}
  <Panel>
   <h3 className="flex items-center gap-2 text-sm font-medium text-console-ink">
    <MessageCircle aria-hidden="true" className="h-4 w-4 text-console-primary"/>Ticket actions
   </h3>
   <div className="mt-4 grid gap-2">
    {ticket.status==="resolved"||ticket.status==="closed"?
     <ActionButton size="sm" variant="outline" disabled={busy} onClick={()=>onAction("reopen")}>Reopen ticket</ActionButton>:
     <>
      {role!=="client"?<ActionButton size="sm" variant="outline" disabled={busy} onClick={()=>onAction("resolve")}>Mark resolved</ActionButton>:null}
      <ActionButton size="sm" variant="outline" disabled={busy} onClick={()=>onAction("close")}>Close ticket</ActionButton>
     </>}
   </div>
  </Panel>
 </aside>;
}
