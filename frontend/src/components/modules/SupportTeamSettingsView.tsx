"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,Plus,Users,Tag,CheckCircle2} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {helpApi,asList,type Department,type SupportTopic,type SupportAgent} from "@/lib/api/modules/help-center.api";
const selectClass="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#0064E0]";
export function SupportTeamSettingsView(){
  const [departments,setDepartments]=useState<Department[]>([]),[topics,setTopics]=useState<SupportTopic[]>([]),[agents,setAgents]=useState<SupportAgent[]>([]);
  const [current,setCurrent]=useState(""),[name,setName]=useState(""),[slug,setSlug]=useState("");
  const [departmentName,setDepartmentName]=useState("");
  const [notice,setNotice]=useState(""),[error,setError]=useState(""),[working,setWorking]=useState(false);
  const [loaded,setLoaded]=useState(false);
  async function load(){
    const [d,t,a]=await Promise.all([helpApi.departments(),helpApi.topics(),helpApi.agents()]);
    setDepartments(asList(d));setTopics(asList(t));setAgents(a);
    setCurrent(v=>v||(asList(d)[0]?String(asList(d)[0].id):""));
  }
  useEffect(()=>{let active=true;
    Promise.all([helpApi.departments(),helpApi.topics(),helpApi.agents()]).then(([d,t,a])=>{
      if(!active)return;const ds=asList(d);setDepartments(ds);setTopics(asList(t));setAgents(a);
      setCurrent(ds[0]?String(ds[0].id):"");
    }).catch(()=>{if(active)setError("Support team settings could not be loaded.");})
    .finally(()=>{if(active)setLoaded(true);});return()=>{active=false;};
  },[]);
  const dept=departments.find(d=>String(d.id)===current);
  const activeTopics=topics.filter(t=>String(t.department)===current);
  async function changeTeam(userId:number,checked:boolean,topic?:SupportTopic){
    if(working||!dept)return;setWorking(true);setError("");setNotice("");
    try{
      const existing=topic?topic.assigned_staff:dept.assigned_staff;
      const next=checked?[...new Set([...existing,userId])]:existing.filter(v=>v!==userId);
      if(topic)await helpApi.updateTopic(topic.id,next);
      else await helpApi.updateDepartment(dept.id,next);
      await load();setNotice("Support responsibilities updated.");
    }catch{setError("Assignment was refused. Assign the agent to the department first, then the topic.");}
    finally{setWorking(false);}
  }
  async function createDepartment(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(working||!departmentName.trim())return;
    setWorking(true);setError("");setNotice("");
    try{
      const saved=await helpApi.createDepartment(departmentName.trim());
      setDepartmentName("");await load();setCurrent(String(saved.id));
      setNotice("Department created. Assign team members before enabling specialist tags.");
    }catch{setError("Couldn't create the department. Check its name or an existing department.");}
    finally{setWorking(false);}
  }

  async function addTopic(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(!dept||working)return;setWorking(true);setError("");setNotice("");
    try{
      const clean=slug.trim().toLowerCase();
      if(!/^[a-z0-9-]{2,40}$/.test(clean))throw Error("invalid");
      await helpApi.createTopic(dept.id,name.trim(),clean);setName("");setSlug("");await load();setNotice("New support topic saved.");
    }catch{setError("Could not create that topic. Check the name and unique short code.");}
    finally{setWorking(false);}
  }
  return <DashboardShell role="admin" title="Support routing" description="Configure departments, topic specialists and responsible staff.">
    <DashboardPage eyebrow="Support operations" title="Teams and support topics"
      description="Assign each team member to departments and the subjects they handle. Customer requests are routed only to eligible agents.">
      <div className="space-y-5">
        <Link href="/admin/support" className="inline-flex items-center gap-2 text-sm font-medium text-[#0064E0]"><ArrowLeft className="h-4 w-4"/>Back to support desk</Link>
        {error?<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>:null}
        {notice?<p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{notice}</p>:null}
        {!loaded?<p role="status" className="rounded-xl bg-white p-6 text-sm text-slate-500">Preparing support teams…</p>:null}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="flex items-center gap-2 text-lg font-medium"><Users className="h-5 w-5 text-[#0064E0]"/>Department responsibilities</h2>
              <label className="mt-5 block"><span className="mb-2 block text-sm font-medium">Department</span>
                <select className={selectClass} value={current} onChange={e=>setCurrent(e.target.value)}>
                  {!departments.length?<option value="">No departments configured</option>:null}
                  {departments.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
                </select></label>
              {dept?<div className="mt-5 grid gap-3 sm:grid-cols-2">{agents.map(agent=>
                <label key={agent.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4">
                  <input type="checkbox" disabled={working} checked={dept.assigned_staff.includes(agent.id)}
                    onChange={e=>void changeTeam(agent.id,e.target.checked)} className="h-4 w-4 accent-[#0064E0]"/>
                  <span className="text-sm font-medium">{agent.full_name||`Agent ${agent.id}`}</span>
                </label>)}</div>:null}
              <p className="mt-4 text-xs leading-5 text-slate-500">Unassigned customer tickets remain in this department's queue. Membership alone does not grant access to unrelated assigned tickets.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="flex items-center gap-2 text-lg font-medium"><Tag className="h-5 w-5 text-[#0064E0]"/>Topic specialists</h2>
              {activeTopics.map(topic=><div key={topic.id} className="mt-5 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium">{topic.label}</h3>
                  <span className="text-xs text-slate-500">{topic.slug}</span></div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">{agents.filter(agent=>dept?.assigned_staff.includes(agent.id)).map(agent=>
                  <label key={agent.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs">
                    <input type="checkbox" disabled={working} checked={topic.assigned_staff.includes(agent.id)}
                      onChange={e=>void changeTeam(agent.id,e.target.checked,topic)} className="accent-[#0064E0]"/>
                    {agent.full_name||`Agent ${agent.id}`}
                  </label>)}</div>
              </div>)}
            </div>
          </section>
          <aside className="h-fit space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="border-b border-slate-100 pb-5">
              <h2 className="text-base font-medium">New department</h2>
              <form onSubmit={createDepartment} className="mt-3 space-y-3">
                <label className="block"><span className="mb-2 block text-sm font-medium">Department name</span>
                  <input className={selectClass} required maxLength={100} value={departmentName}
                    onChange={e=>setDepartmentName(e.target.value)} placeholder="Technical Support"/></label>
                <button type="submit" disabled={working} className="w-full rounded-xl border border-[#0064E0] px-4 py-3 text-sm font-medium text-[#0064E0] disabled:opacity-50">
                  Add department
                </button>
              </form>
            </div>
            <h2 className="flex items-center gap-2 text-base font-medium"><Plus className="h-5 w-5 text-[#0064E0]"/>Add issue topic</h2>
            <p className="text-sm leading-6 text-slate-600">For example: DNS, Email, SSL, Billing or WordPress. Every topic belongs to an approved support department.</p>
            <form onSubmit={addTopic} className="space-y-4">
              <label className="block"><span className="mb-2 block text-sm font-medium">Topic label</span>
                <input className={selectClass} required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="DNS support"/></label>
              <label className="block"><span className="mb-2 block text-sm font-medium">Short code</span>
                <input className={selectClass} required maxLength={40} value={slug} onChange={e=>setSlug(e.target.value)} placeholder="dns"/></label>
              <button type="submit" disabled={!dept||working} className="w-full rounded-xl bg-[#0064E0] px-5 py-3 text-sm font-medium text-white disabled:opacity-50">Create topic</button>
            </form>
            <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>
              First assign a team member to a department, then to one or more topics. The routing engine selects the least busy eligible member.
            </div>
          </aside>
        </div>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
