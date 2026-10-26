"use client";
import {useEffect,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {ArrowLeft,BookOpen,LifeBuoy,ShieldCheck} from "lucide-react";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {clientApi} from "@/lib/api/endpoints";
import {SupportRequestFields} from "@/features/support/components/SupportRequestFields";
import {Panel} from "@/components/design-system/Panel";
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
  return <DashboardShell role="client" title="Get support" description="Speak with the right Octalve Cloud support team.">
    <DashboardPage eyebrow="Help centre" title="Tell us what you need help with"
      description="Your request goes to the appropriate support specialists and stays visible in your account.">
      <div className="grid min-w-0 gap-5 xl:grid-cols-3">
        <Panel className="min-w-0 p-5 sm:p-8 xl:col-span-2">
          <Link href="/client/support" className="inline-flex items-center gap-2 text-sm font-medium text-[#0064E0]"><ArrowLeft className="h-4 w-4"/>My support tickets</Link>
          <h2 className="mt-6 text-xl font-medium text-slate-950">New support request</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Choose the area and issue type. We’ll route your ticket to an eligible team member, or keep it in the team's queue.</p>
          {error?<p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>:null}
          <SupportRequestFields values={{department,topic,subject,message,priority}}
            departments={departments} topics={topics} loading={loading} busy={busy}
            onChange={(key,value)=>{
              if(key==="department")setDepartment(value);
              else if(key==="topic")setTopic(value);
              else if(key==="subject")setSubject(value);
              else if(key==="message")setMessage(value);
              else setPriority(value);
            }}
            onSubmit={submit}/>
        </Panel>
        <aside className="min-w-0 space-y-4 xl:col-span-1">
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
