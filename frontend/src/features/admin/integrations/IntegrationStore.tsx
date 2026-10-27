"use client";
import Link from "next/link";
import {useEffect,useMemo,useRef,useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import {Search} from "lucide-react";
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
   <Link href="/admin/servers" className="text-sm font-semibold text-console-primary hover:underline">Existing provider records</Link>
  </div>
  <section aria-label="Integration catalogue" className="overflow-hidden rounded-2xl border border-console-line bg-white">
   <div className="flex flex-col gap-3 border-b border-console-line p-4 md:flex-row md:items-center md:justify-between">
    <label className="relative block w-full max-w-lg"><span className="sr-only">Search integrations</span>
     <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-console-muted"/>
     <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search integrations" autoComplete="off"
      className="min-h-11 w-full rounded-xl border border-console-line bg-slate-50 pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-console-primary"/>
    </label><p aria-live="polite" className="text-xs font-semibold text-console-muted">{visible.length} integrations</p>
   </div>
   <div aria-label="Integration categories" className="flex flex-wrap gap-2 border-b border-console-line p-4">
    {categories.map(c=><button key={c} type="button" onClick={()=>setCategory(c)} aria-pressed={category===c}
      className={"min-h-9 rounded-full px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary "+(category===c?"bg-blue-50 text-console-primary":"bg-slate-100 text-slate-600 hover:bg-slate-200")}>{c}</button>)}
   </div>
   {visible.length?<ul onClickCapture={e=>{const target=e.target;if(target instanceof HTMLElement)opener.current=target.closest("a");}}
     className="grid min-w-0 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(item=><ProviderCard key={item.slug} item={item} drafts={connectionOverview.connections.filter(c=>c.adapter_key===item.slug)}/>)}</ul>
    :<p role="status" className="p-10 text-center text-sm text-console-muted">No matches. Try another search or category.</p>}
  </section>
  <p className="mt-4 text-xs text-console-muted">A visible vendor is not a connected supplier, an approved reseller or a qualified provisioning adapter.</p>
 </DashboardPage>
 {selected?<ProviderSideSheet key={selected.slug} item={selected} onClose={close} drafts={connectionOverview.connections.filter(c=>c.adapter_key===selected.slug)} draftSchemaAvailable={connectionOverview.supported.has(selected.slug)}/>:null}
 </DashboardShell>;
}
