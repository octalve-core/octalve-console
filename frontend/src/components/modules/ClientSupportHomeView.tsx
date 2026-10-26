"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {ArrowRight,BookOpen,Headphones,Plus,Search} from "lucide-react";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {clientApi} from "@/lib/api/endpoints";
import {SupportTicketCards} from "@/features/support/components/SupportTicketCards";
import {TextField} from "@/components/design-system/TextField";
import {asList,type TicketDetail} from "@/lib/api/modules/help-center.api";
export function ClientSupportHomeView(){
  const [tickets,setTickets]=useState<TicketDetail[]>([]),[query,setQuery]=useState("");
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{let live=true;
    clientApi.tickets().then(v=>{if(live)setTickets(asList(v as unknown as TicketDetail[]|{results:TicketDetail[]}));})
      .catch(()=>{if(live)setError("Your support history isn't available right now.");})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};},[]);
  const results=useMemo(()=>tickets.filter(t=>[t.subject,t.ticket_number,t.department_name].join(" ").toLowerCase().includes(query.toLowerCase())),[tickets,query]);
  return <DashboardShell role="client" title="Support" description="Help with your hosting, domains and billing.">
    <DashboardPage eyebrow="Help centre" title="How can we help you today?"
      description="Explore reliable guides or start a private conversation with the right support team.">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/client/support/new" className="group rounded-2xl bg-[#001426] p-7 text-white transition hover:shadow-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600"><Headphones className="h-6 w-6"/></div>
            <h2 className="mt-5 text-xl font-medium">Contact support</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-300">Tell us what happened. Your request will reach the relevant team, and we'll keep the conversation in your account.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-blue-200">Open a new ticket <ArrowRight className="h-4 w-4 group-hover:translate-x-1"/></span>
          </Link>
          <Link href="/client/knowledge-base" className="group rounded-2xl border border-slate-200 bg-white p-7 transition hover:border-blue-200 hover:shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#0064E0]"><BookOpen className="h-6 w-6"/></div>
            <h2 className="mt-5 text-xl font-medium text-slate-950">Help guides</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">Find step-by-step articles on setting up services, connecting domains and understanding your invoices.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#0064E0]">Browse the knowledge base <ArrowRight className="h-4 w-4 group-hover:translate-x-1"/></span>
          </Link>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-medium text-slate-950">Your support requests</h2>
              <p className="mt-1 text-sm text-slate-500">All requests submitted from your account.</p></div>
            <Link href="/client/support/new" className="inline-flex items-center gap-2 rounded-xl bg-[#0064E0] px-4 py-2.5 text-sm font-medium text-white"><Plus className="h-4 w-4"/>New ticket</Link>
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 px-4">
            <Search className="h-4 w-4 text-slate-400"/>
            <input aria-label="Search your tickets" value={query} onChange={e=>setQuery(e.target.value)}
              placeholder="Search requests…" className="h-12 min-w-0 flex-1 text-sm outline-none"/>
          </div>
          {error?<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>:null}
          {loading?<p role="status" className="mt-5 text-sm text-slate-500">Opening your tickets…</p>:null}
          <div className="mt-5">
            {!loading&&!error?<SupportTicketCards role="client" tickets={results}
              emptyTitle="No support requests yet"
              emptyDescription="Your submitted tickets and replies will appear here."/>:null}
          </div>
        </section>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
