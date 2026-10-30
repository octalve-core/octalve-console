"use client";
import Link from "next/link";
import {useEffect,useMemo,useRef,useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {Search,BookOpenCheck,KeyRound,ShieldCheck} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {catalog,categories} from "./catalog";
import {ProviderCard} from "./ProviderCard";
import {ProviderSideSheet} from "./ProviderSideSheet";
import {useConnectionOverview} from "./useConnectionOverview";
export function IntegrationStore(){
 const router=useRouter(),params=useSearchParams();
 const connectionOverview=useConnectionOverview();
 const [query,setQuery]=useState(""),[category,setCategory]=useState<string>("All");
 const opener=useRef<HTMLAnchorElement|null>(null);
 const slug=params.get("provider"),selected=catalog.find(item=>item.slug===slug);
 useEffect(()=>{if(slug&&!selected)router.replace("/admin/integrations",{scroll:false});},[slug,selected,router]);
 const visible=useMemo(()=>catalog.filter(item=>(category==="All"||category===item.category)&&
  [item.name,item.summary,item.category,...item.capabilities].join(" ").toLowerCase().includes(query.trim().toLowerCase())),[category,query]);
 const close=()=>{router.replace("/admin/integrations",{scroll:false});opener.current?.focus();};
 return <DashboardShell role="admin" title="Integrations" description="Review available supplier integrations.">
 <DashboardPage eyebrow="Infrastructure" title="Integration Store"
  description="Discover hosting panels, registrars, DNS, payments, business email, cloud services and storage.">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
   <p className="text-sm text-console-muted">Supplier operations are disabled. {connectionOverview.status==="ready"
 ? connectionOverview.connections.filter(c=>c.state==="draft").length+" encrypted drafts saved."
: connectionOverview.status==="unavailable"?"Connection registry is not available yet.":"Checking saved drafts…"}</p>
   <div className="flex flex-wrap items-center gap-3">
    {connectionOverview.status==="unavailable"?<button type="button" onClick={connectionOverview.retry}
      className="min-h-10 rounded-xl border border-console-line px-3 py-2 text-xs font-medium text-console-primary hover:bg-blue-50">Retry connection status</button>:null}
    <Link href="/admin/servers" className="text-sm font-medium text-console-primary hover:underline">Existing provider records</Link>
   </div>
  </div>
  <section aria-label="How integrations connect" className="mb-5 grid gap-3 md:grid-cols-3">
   {[
    {icon:Search,title:"1. Choose a service",detail:"Explore hosting, email, domain and payment providers and review what each one requires."},
    {icon:KeyRound,title:"2. Prepare securely",detail:"Keep API keys and service secrets in approved server-side custody, never in browser storage."},
    {icon:ShieldCheck,title:"3. Verify before use",detail:"Activate only after access permissions, connection readback and the required security tests succeed."},
   ].map(({icon:Icon,title,detail})=><article key={title} className="rounded-xl border border-console-line bg-white p-4 shadow-sm">
     <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-console-primary">
      <Icon aria-hidden="true" className="h-4 w-4"/>
     </div>
     <h2 className="text-sm font-medium text-console-ink">{title}</h2>
     <p className="mt-1.5 text-xs leading-5 text-console-muted">{detail}</p>
   </article>)}
  </section>
  <section aria-label="Integration catalogue" className="overflow-hidden rounded-2xl border border-console-line bg-white">
   <div className="flex flex-col gap-3 border-b border-console-line p-4 md:flex-row md:items-center md:justify-between">
    <label className="relative block w-full max-w-lg"><span className="sr-only">Search integrations</span>
     <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-console-muted"/>
     <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search integrations" autoComplete="off"
      className="min-h-11 w-full rounded-xl border border-console-line bg-slate-50 pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-console-primary"/>
    </label><p aria-live="polite" className="text-xs font-medium text-console-muted">{visible.length} integrations</p>
   </div>
   <div aria-label="Integration categories" className="flex flex-wrap gap-2 border-b border-console-line p-4">
    {categories.map(c=><button key={c} type="button" onClick={()=>setCategory(c)} aria-pressed={category===c}
      className={"min-h-9 rounded-full px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary "+(category===c?"bg-blue-50 text-console-primary":"bg-slate-100 text-slate-600 hover:bg-slate-200")}>{c}</button>)}
   </div>
   {visible.length?<ul onClickCapture={e=>{const target=e.target;if(target instanceof HTMLElement)opener.current=target.closest("a");}}
     className="grid min-w-0 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(item=><ProviderCard key={item.slug} item={item} overviewStatus={connectionOverview.status} drafts={connectionOverview.connections.filter(c=>c.adapter_key===item.slug)}/>)}</ul>
    :<p role="status" className="p-10 text-center text-sm text-console-muted">No matches. Try another search or category.</p>}
  </section>
  <p className="mt-4 text-xs text-console-muted">A visible vendor is not a connected supplier, an approved reseller or a qualified provisioning adapter.</p>
 </DashboardPage>
 {selected?<ProviderSideSheet key={selected.slug} item={selected} onClose={close} drafts={connectionOverview.connections.filter(c=>c.adapter_key===selected.slug)} draftSchemaAvailable={connectionOverview.supported.has(selected.slug)} overviewStatus={connectionOverview.status}/>:null}
 </DashboardShell>;
}
