"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {ArrowLeft} from "lucide-react";
import {TicketMessageThread} from "@/features/support/components/TicketMessageThread";
import {TicketReplyComposer} from "@/features/support/components/TicketReplyComposer";
import {TicketContextPanels} from "@/features/support/components/TicketContextPanels";
import {Panel} from "@/components/design-system/Panel";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {helpApi,asList,type TicketDetail,type SupportAgent,type Department,type SupportTopic} from "@/lib/api/modules/help-center.api";
type Role="admin"|"staff"|"client";
export function TicketConversationView({role}:{role:Role}){
  const params=useParams<{id:string}>(),id=String(params.id||"");
  const [ticket,setTicket]=useState<TicketDetail|null>(null),[agents,setAgents]=useState<SupportAgent[]>([]);
  const [departments,setDepartments]=useState<Department[]>([]),[topics,setTopics]=useState<SupportTopic[]>([]);
  const [reply,setReply]=useState(""),[internal,setInternal]=useState(false),[busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const back=role==="client"?"/client/support":role==="staff"?"/staff/tickets":"/admin/support";
  const refresh=useCallback(async()=>{const result=await helpApi.ticket(id);setTicket(result);},[id]);
  useEffect(()=>{let active=true;
    void refresh().catch(()=>{if(active)setError("This ticket is unavailable or you do not have access.");})
      .finally(()=>{if(active)setLoading(false);});
    if(role==="admin")void Promise.all([helpApi.agents(),helpApi.departments(),helpApi.topics()])
      .then(([people,d,t])=>{if(active){setAgents(people);setDepartments(asList(d));setTopics(asList(t));}})
      .catch(()=>{});
    return()=>{active=false;};
  },[refresh,role]);
  async function send(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!reply.trim()||busy)return;
    setBusy(true);setError("");setNotice("");
    try{await helpApi.reply(id,reply.trim(),role==="client"?false:internal);
      setReply("");setInternal(false);await refresh();setNotice("Your reply is saved.");}
    catch{setError("We couldn't send this reply. Please check the ticket status.");}
    finally{setBusy(false);}
  }
  async function action(action:string,staff_id?:number){
    if(busy)return;setBusy(true);setError("");setNotice("");
    try{await helpApi.action(id,{action,...(staff_id?{staff_id}:{})});await refresh();setNotice("Ticket updated.");}
    catch{setError("This action couldn't be completed. Check permissions and team assignment.");}
    finally{setBusy(false);}
  }
  const eligibleAgents=agents.filter(agent=>{
    if(!ticket)return false;
    const department=departments.find(item=>item.id===ticket.department);
    if(!department?.assigned_staff.includes(agent.id))return false;
    if(ticket.routing_tag){
      const topic=topics.find(item=>item.id===ticket.routing_tag);
      return Boolean(topic?.assigned_staff.includes(agent.id));
    }
    return true;
  });
  const canReply=ticket&&!["closed","trash"].includes(ticket.status);
  return <DashboardShell role={role} title="Support conversation" description="Secure ticket history and support messages.">
    <DashboardPage eyebrow="Support" title={ticket?.subject||"Support ticket"} description="Follow your conversation and its latest status.">
      <div className="grid min-w-0 gap-5 xl:grid-cols-3">
        <Panel className="min-w-0 p-5 sm:p-7 xl:col-span-2">
          <Link href={back} className="inline-flex items-center gap-2 text-sm font-medium text-[#0064E0]"><ArrowLeft className="h-4 w-4"/>Back to tickets</Link>
          {loading?<p role="status" className="mt-5 text-sm text-slate-500">Opening conversation…</p>:null}
          {error?<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>:null}
          {notice?<p role="status" className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{notice}</p>:null}
          {ticket?<div className="mt-6 space-y-6">
            <TicketMessageThread ticket={ticket}/>
            {canReply?<TicketReplyComposer role={role} reply={reply} internal={internal} busy={busy}
              onReplyChange={setReply} onInternalChange={setInternal} onSubmit={send}/>:<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">This ticket is closed. Reopen it to continue the conversation.</p>}
          </div>:null}
        </Panel>
        <TicketContextPanels role={role} ticket={ticket} eligibleAgents={eligibleAgents} busy={busy}
          onAction={name=>{void action(name);}} onAssign={staffId=>{void action("assign",staffId);}}/>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
