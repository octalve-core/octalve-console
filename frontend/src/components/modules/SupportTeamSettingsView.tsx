"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowLeft,Users,Tag} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {SelectField} from "@/components/design-system/SelectField";
import {SupportRoutingCreateForms} from "@/features/support/components/SupportRoutingCreateForms";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {helpApi,asList,type Department,type SupportTopic,type SupportAgent} from "@/lib/api/modules/help-center.api";
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
        <div className="grid min-w-0 gap-5 xl:grid-cols-3">
          <section className="min-w-0 space-y-5 xl:col-span-2">
            <Panel>
              <h2 className="flex items-center gap-2 text-lg font-medium"><Users className="h-5 w-5 text-[#0064E0]"/>Department responsibilities</h2>
              <div className="mt-5">
                <SelectField label="Department" value={current} disabled={working}
                  options={departments.length?departments.map(item=>({value:String(item.id),label:item.name})):
                    [{value:"",label:"No departments configured"}]}
                  onChange={e=>setCurrent(e.target.value)}/>
              </div>
              {dept?<div className="mt-5 grid gap-3 sm:grid-cols-2">{agents.map(agent=>
                <label key={agent.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4">
                  <input type="checkbox" disabled={working} checked={dept.assigned_staff.includes(agent.id)}
                    onChange={e=>void changeTeam(agent.id,e.target.checked)} className="h-4 w-4 accent-[#0064E0]"/>
                  <span className="text-sm font-medium">{agent.full_name||`Agent ${agent.id}`}</span>
                </label>)}</div>:null}
              <p className="mt-4 text-xs leading-5 text-slate-500">Unassigned customer tickets remain in this department's queue. Membership alone does not grant access to unrelated assigned tickets.</p>
            </Panel>
            <Panel>
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
            </Panel>
          </section>
          <SupportRoutingCreateForms
            departmentName={departmentName} name={name} slug={slug}
            working={working} hasDepartment={Boolean(dept)}
            onDepartmentNameChange={setDepartmentName} onNameChange={setName} onSlugChange={setSlug}
            onCreateDepartment={createDepartment} onCreateTopic={addTopic}/>
        </div>
      </div>
    </DashboardPage>
  </DashboardShell>;
}
