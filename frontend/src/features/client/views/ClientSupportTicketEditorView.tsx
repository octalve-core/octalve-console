"use client";
import {useEffect,useMemo,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowLeft,BookOpen,LifeBuoy,Send,ShieldCheck} from "lucide-react";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {clientApi} from "@/lib/api/endpoints";
import {helpApi,asList,type Department,type SupportTopic,type TicketDetail} from "@/lib/api/modules/help-center.api";
export function ClientSupportTicketEditorView(){
  const router=useRouter();
  const [departments,setDepartments]=useState<Department[]>([]),[topics,setTopics]=useState<SupportTopic[]>([]);
  const [department,setDepartment]=useState(""),[topic,setTopic]=useState("");
  const [subject,setSubject]=useState(""),[message,setMessage]=useState(""),[priority,setPriority]=useState("medium");
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{let active=true;
    Promise.all([helpApi.departments(),helpApi.topics()]).then(([a,b])=>{
      if(!active)return;
      const d=asList(a).filter(item=>item.is_active);
      setDepartments(d);setTopics(asList(b).filter(item=>item.is_active));
    }).catch(()=>{if(active)setError("Support categories aren't available. Please try again later.");})
    .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};},[]);
  const relevant=useMemo(()=>topics.filter(item=>String(item.department)===department),[topics,department]);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(busy||!department)return;setBusy(true);setError("");
    try{
      const response=await clientApi.createTicket({
        department_id:Number(department),
        routing_tag_id:topic?Number(topic):null,
        subject:subject.trim(),message:message.trim(),priority
      }) as unknown as TicketDetail;
      if(!response.id||!response.ticket_number)throw Error("Ticket not confirmed");
      router.push(`/client/support/${encodeURIComponent(String(response.id))}`);
    }catch{setError("We couldn't submit your request. Review the details and try again.");setBusy(false);}
  }
  const input="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-[#0064E0]";
  return <DashboardShell role="client" title="Get support" description="Speak with the right Octalve Cloud support team.">
    <DashboardPage eyebrow="Help centre" title="Tell us what you need help with"
      description="Your request goes to the appropriate support specialists and stays visible in your account.">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
          <Link href="/client/support" className="inline-flex items-center gap-2 text-sm font-medium text-[#0064E0]"><ArrowLeft className="h-4 w-4"/>My support tickets</Link>
          <h2 className="mt-6 text-xl font-medium text-slate-950">New support request</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Choose the area and issue type. We’ll route your ticket to an eligible team member, or keep it in the team's queue.</p>
          {error?<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>:null}
          <form onSubmit={submit} className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <label><span className="mb-2 block text-sm font-medium">Support department</span>
                <select required aria-label="Support department" disabled={loading} className={input} value={department}
                  onChange={e=>{setDepartment(e.target.value);setTopic("");}}>
                  <option value="">Choose a department</option>
                  {departments.map(dept=><option key={dept.id} value={String(dept.id)}>{dept.name}</option>)}
                </select></label>
              <label><span className="mb-2 block text-sm font-medium">Issue topic</span>
                <select aria-label="Issue topic" className={input} value={topic} disabled={!department||loading}
                  onChange={e=>setTopic(e.target.value)}>
                  <option value="">General question</option>
                  {relevant.map(item=><option key={item.id} value={String(item.id)}>{item.label}</option>)}
                </select></label>
            </div>
            <label className="block"><span className="mb-2 block text-sm font-medium">Subject</span>
              <input required maxLength={500} value={subject} onChange={e=>setSubject(e.target.value)}
                placeholder="Briefly describe the issue" className={input}/></label>
            <label className="block"><span className="mb-2 block text-sm font-medium">Priority</span>
              <select className={input} value={priority} onChange={e=>setPriority(e.target.value)}>
                <option value="low">Low — General question</option>
                <option value="medium">Normal — Needs attention</option>
                <option value="high">High — Service disruption</option>
                <option value="urgent">Urgent — Critical service issue</option>
              </select></label>
            <label className="block"><span className="mb-2 block text-sm font-medium">How can we help?</span>
              <textarea required maxLength={20000} minLength={10} rows={7} value={message} onChange={e=>setMessage(e.target.value)}
                placeholder="Explain what happened, when it started, and the domain or service affected. Never share your password or card details."
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-sm leading-7 outline-none focus-visible:ring-2 focus-visible:ring-[#0064E0]"/></label>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
              <p className="max-w-sm text-xs leading-5 text-slate-500">Do not include login credentials or sensitive payment details. File attachments are not yet available.</p>
              <button type="submit" disabled={busy||loading||!department||message.trim().length<10}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0064E0] px-5 py-3 text-sm font-medium text-white disabled:opacity-50">
                <Send className="h-4 w-4"/>{busy?"Sending…":"Send request"}</button>
            </div>
          </form>
        </section>
        <aside className="space-y-4">
          <section className="rounded-2xl bg-[#001426] p-6 text-white">
            <LifeBuoy className="h-7 w-7 text-blue-300"/>
            <h3 className="mt-4 text-lg font-medium">We're here to help</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">Track replies and continue the conversation from your support history.</p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-[#0064E0]"/>Private support</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Tickets are linked to your account. Only authorized support staff can access them.</p>
            <Link href="/client/knowledge-base" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#0064E0]"><BookOpen className="h-4 w-4"/>Explore help guides</Link>
          </section>
        </aside>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
