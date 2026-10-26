"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {Inbox,Clock3,CheckCircle2,Users,Settings2,Search} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {supportApi} from "@/lib/api/modules/support.api";
import {SupportTicketCards} from "@/features/support/components/SupportTicketCards";
import {TextField} from "@/components/design-system/TextField";
import {Panel} from "@/components/design-system/Panel";
import {asList,type TicketDetail} from "@/lib/api/modules/help-center.api";
type Role="admin"|"staff";
const open=new Set(["open","in_progress","waiting_staff","on_hold"]);
export function SupportDeskView({role}:{role:Role}){
  const [tickets,setTickets]=useState<TicketDetail[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[query,setQuery]=useState(""),[filter,setFilter]=useState("active");
  useEffect(()=>{let active=true;supportApi.tickets().then(result=>{if(active)setTickets(asList(result as unknown as TicketDetail[]|{results:TicketDetail[]}));})
    .catch(()=>{if(active)setError("We couldn't load the support queue. Refresh the page and try again.");})
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
        <TextField label="Search support tickets" type="search" value={query}
          onChange={event=>setQuery(event.target.value)}
          startIcon={<Search aria-hidden="true" className="h-5 w-5"/>}
          placeholder="Search subject, ticket number or team…"/>
        {error?<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>:null}
        {loading?<p role="status" className="rounded-xl bg-white p-6 text-sm text-slate-500">Opening your support queue…</p>:null}
        {!loading&&!error?<SupportTicketCards role={role} tickets={shown}
          emptyTitle="No tickets in this view"
          emptyDescription="Incoming tickets assigned to your team will appear here."/>:null}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4 text-[#0064E0]"/>Team assignments</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Tickets without an eligible specialist remain in the department queue for review. They are never silently assigned to unrelated staff.</p>
        </div>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
