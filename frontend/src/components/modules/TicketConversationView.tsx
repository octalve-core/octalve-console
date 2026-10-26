"use client";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {ArrowLeft,Headphones,MessageCircle,Send,ShieldCheck,UserRound,Settings2} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {helpApi,asList,type TicketDetail,type SupportAgent,type Department,type SupportTopic} from "@/lib/api/modules/help-center.api";
type Role="admin"|"staff"|"client";
const stateLabels:Record<string,string>={open:"Open",in_progress:"In progress",waiting_customer:"Waiting for customer",
 waiting_staff:"Waiting for staff",on_hold:"On hold",resolved:"Resolved",closed:"Closed"};
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
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <Link href={back} className="inline-flex items-center gap-2 text-sm font-medium text-[#0064E0]"><ArrowLeft className="h-4 w-4"/>Back to tickets</Link>
          {loading?<p role="status" className="mt-5 text-sm text-slate-500">Opening conversation…</p>:null}
          {error?<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>:null}
          {notice?<p role="status" className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{notice}</p>:null}
          {ticket?<div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-5">
              <span className="text-sm font-medium text-[#0064E0]">{ticket.ticket_number}</span>
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-[#0064E0]">{stateLabels[ticket.status]||ticket.status}</span>
              <span className="text-xs text-slate-500">{ticket.department_name}</span>
            </div>
            <div className="space-y-5">
              {ticket.messages.map(item=>{
                const agent=item.sender_role!=="client";
                return <div key={item.id} className={`flex gap-3 ${agent?"":"flex-row-reverse"}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${agent?"bg-[#EFF6FF] text-[#0064E0]":"bg-slate-100 text-slate-700"}`}>
                    {agent?<Headphones className="h-4 w-4"/>:<UserRound className="h-4 w-4"/>}</div>
                  <div className={`max-w-[85%] rounded-2xl p-4 ${agent?"bg-[#F2F7FD]":"bg-slate-50"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-slate-800">{item.sender_name_display||item.sender_role}</span>
                      {item.is_internal?<span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">Internal note</span>:null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{item.message}</p>
                    <p className="mt-2 text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString()}</p>
                  </div>
                </div>;
              })}
            </div>
            {canReply?<form onSubmit={send} className="border-t border-slate-100 pt-5">
              <label htmlFor="ticket-reply" className="mb-2 block text-sm font-medium">Write a reply</label>
              <textarea id="ticket-reply" required maxLength={20000} rows={5} value={reply}
                onChange={e=>setReply(e.target.value)} placeholder="Write a helpful response…"
                className="w-full rounded-xl border border-slate-200 p-4 text-sm leading-7 outline-none focus-visible:ring-2 focus-visible:ring-[#0064E0]"/>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                {role!=="client"?<label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={internal} onChange={e=>setInternal(e.target.checked)} className="accent-[#0064E0]"/>Internal note (hidden from customer)</label>:<span className="text-xs text-slate-500">Your reply is visible to authorized support staff.</span>}
                <button type="submit" disabled={busy||!reply.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#0064E0] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"><Send className="h-4 w-4"/>{busy?"Sending…":"Send reply"}</button>
              </div>
            </form>:<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">This ticket is closed. Reopen it to continue the conversation.</p>}
          </div>:null}
        </section>
        <aside className="h-fit space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-[#0064E0]"/>Ticket details</h3>
            {ticket?<dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-slate-500">Team</dt><dd className="mt-1 font-medium">{ticket.department_name}</dd></div>
              <div><dt className="text-slate-500">Assigned specialist</dt><dd className="mt-1 font-medium">{ticket.assigned_to_name||"Department queue"}</dd></div>
              <div><dt className="text-slate-500">Priority</dt><dd className="mt-1 font-medium capitalize">{ticket.priority}</dd></div>
            </dl>:null}
          </section>
          {role==="admin"&&ticket?<section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="flex items-center gap-2 text-sm font-medium"><Settings2 className="h-4 w-4 text-[#0064E0]"/>Manage assignment</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">Only eligible department specialists can be assigned.</p>
            <select aria-label="Assign support specialist" value={ticket.assigned_to||""}
              onChange={e=>{const id=Number(e.target.value);if(id)void action("assign",id);}}
              className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">Department queue</option>
              {eligibleAgents.map(agent=><option key={agent.id} value={agent.id}>{agent.full_name||`Agent #${agent.id}`}</option>)}
            </select>
          </section>:null}
          {ticket?<section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="flex items-center gap-2 text-sm font-medium"><MessageCircle className="h-4 w-4 text-[#0064E0]"/>Ticket actions</h3>
            <div className="mt-4 grid gap-2">
              {ticket.status==="resolved"||ticket.status==="closed"?<button onClick={()=>void action("reopen")} type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium">Reopen ticket</button>:
                <>
                  {role!=="client"?<button onClick={()=>void action("resolve")} type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium">Mark resolved</button>:null}
                  <button onClick={()=>void action("close")} type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium">Close ticket</button>
                </>}
            </div>
          </section>:null}
        </aside>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
