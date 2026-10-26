"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {LifeBuoy,Search,Inbox,Clock3,CheckCircle2,Users,ArrowRight,Settings2} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {supportApi} from "@/lib/api/modules/support.api";
import {asList,type TicketDetail} from "@/lib/api/modules/help-center.api";
type Role="admin"|"staff";
const open=new Set(["open","in_progress","waiting_staff","on_hold"]);
export function SupportDeskView({role}:{role:Role}){
  const [tickets,setTickets]=useState<TicketDetail[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[query,setQuery]=useState(""),[filter,setFilter]=useState("active");
  useEffect(()=>{let active=true;supportApi.tickets().then(result=>{if(active)setTickets(asList(result as unknown as TicketDetail[]|{results:TicketDetail[]}));})
    .catch(()=>{if(active)setError("Tickets could not be loaded. Please reopen your workspace.");})
    .finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  const shown=useMemo(()=>tickets.filter(t=>(filter==="all"||(
    filter==="active"?open.has(t.status):filter===t.status))&&
    [t.subject,t.ticket_number,t.client_name,t.department_name,t.priority].join(" ").toLowerCase().includes(query.toLowerCase())
  ),[tickets,filter,query]);
  const count=tickets.filter(t=>open.has(t.status)).length;
  return <DashboardShell role={role} title="Support desk" description="Manage customer requests and specialist queues.">
    <DashboardPage eyebrow="Customer support" title={role==="admin"?"Support operations":"My support queue"}
      description="Every ticket has a responsible department, clear status and private conversation.">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {title:"Active requests",count,icon:Inbox},
            {title:"Waiting for staff",count:tickets.filter(t=>t.status==="waiting_staff"||t.status==="open").length,icon:Clock3},
            {title:"Resolved / closed",count:tickets.filter(t=>t.status==="resolved"||t.status==="closed").length,icon:CheckCircle2},
          ].map(({title,count,icon:Icon})=><div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
            <Icon className="h-5 w-5 text-[#0064E0]"/>
            <p className="mt-4 text-2xl font-medium text-slate-950">{loading?"—":count}</p>
            <p className="mt-1 text-xs text-slate-500">{title}</p>
          </div>)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {([["active","Active"],["waiting_customer","Waiting for customer"],["resolved","Resolved"],["all","All"]] as const).map(([value,label])=>
              <button key={value} type="button" onClick={()=>setFilter(value)} aria-pressed={filter===value}
                className={`rounded-full border px-4 py-2 text-xs font-medium ${filter===value?"border-blue-200 bg-blue-50 text-[#0064E0]":"border-slate-200 bg-white text-slate-600"}`}>{label}</button>)}
          </div>
          {role==="admin"?<Link href="/admin/support/staff" className="inline-flex items-center gap-2 text-sm font-medium text-[#0064E0]">
            <Settings2 className="h-4 w-4"/>Manage teams and topics</Link>:null}
        </div>
        <div className="flex min-h-14 min-w-0 items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2 focus-within:border-[#0064E0] focus-within:ring-2 focus-within:ring-blue-100"><Search className="h-5 w-5 text-slate-400"/>
          <input aria-label="Search tickets" className="h-10 min-w-0 flex-1 bg-transparent text-base text-slate-950 outline-none placeholder:text-slate-400" value={query}
            onChange={e=>setQuery(e.target.value)} placeholder="Search subject, ticket number or team…"/></div>
        {error?<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>:null}
        {loading?<p role="status" className="rounded-xl bg-white p-6 text-sm text-slate-500">Opening your support queue…</p>:null}
        {!loading&&!shown.length?<div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <LifeBuoy className="mx-auto h-8 w-8 text-[#0064E0]"/><p className="mt-4 text-base font-medium">No tickets in this view</p>
          <p className="mt-2 text-sm text-slate-500">Incoming tickets assigned to your team will appear here.</p>
        </div>:null}
        <div className="space-y-3">
          {shown.map(ticket=><Link href={`/${role}/${role==="staff"?"tickets":"support"}/${ticket.id}`} key={ticket.id}
            className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-5 transition hover:border-blue-200 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-[#0064E0]">{ticket.ticket_number}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">{ticket.department_name}</span>
                <span className="text-[11px] capitalize text-slate-500">{ticket.priority}</span>
              </div>
              <h3 className="mt-2 text-base font-medium text-slate-950">{ticket.subject}</h3>
              <p className="mt-1 text-xs text-slate-500">{ticket.client_name} · {ticket.assigned_to_name||"Team queue"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs capitalize text-[#0064E0]">{ticket.status.replaceAll("_"," ")}</span>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-[#0064E0]"/>
            </div>
          </Link>)}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4 text-[#0064E0]"/>Team assignments</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Tickets without an eligible specialist remain in the department queue for review. They are never silently assigned to unrelated staff.</p>
        </div>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
