"use client";

import Link from "next/link";
import {useEffect,useId,useState} from "react";
import {ChevronDown,Globe2,PackageCheck} from "lucide-react";
import {publicApi,type PublishedServiceCategory} from "@/lib/api/endpoints";
import {routes} from "@/lib/routes";
import {cn} from "@/lib/utils";

const baseLink = "flex min-h-10 min-w-0 items-center rounded-lg px-3 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80";
const secondary = "text-slate-300 hover:bg-white/10 hover:text-white";
const current = "bg-white/10 text-white";

function NavChild({href,label,pathname,onNavigate}:{
  href:string;label:string;pathname:string;onNavigate:()=>void;
}) {
  const active = !/[?#]/.test(href) && pathname === href;
  return <li><Link href={href} onClick={onNavigate} aria-current={active?"page":undefined}
    className={cn(baseLink,active?current:secondary)}>{label}</Link></li>;
}

function NavRoot({href,label,active,onNavigate,expanded,onExpand,controls,icon:Icon}:{
  href:string;label:string;active:boolean;onNavigate:()=>void;expanded:boolean;
  onExpand:()=>void;controls:string;icon:typeof PackageCheck;
}){
  return <div className={cn("flex min-w-0 items-center rounded-xl",active?"bg-console-primary":"hover:bg-white/10")}>
    <Link href={href} onClick={onNavigate} aria-current={active?"page":undefined}
      className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl py-2.5 pl-3 pr-1 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true"/><span className="truncate">{label}</span>
    </Link>
    <button type="button" aria-label={expanded?"Collapse "+label:"Expand "+label} aria-controls={controls}
      aria-expanded={expanded} onClick={onExpand}
      className="mr-1 flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
      <ChevronDown className={cn("h-4 w-4 transition-transform",expanded?"rotate-180":"")} aria-hidden="true"/>
    </button>
  </div>;
}

/** Authenticated client sidebar discovery only; published category != supplier readiness. */
export function ClientServicesNavigation({pathname,onNavigate}:{
  pathname:string;onNavigate:()=>void;
}){
  const [expanded,setExpanded]=useState(true);
  const [categories,setCategories]=useState<PublishedServiceCategory[]>([]);
  const [unavailable,setUnavailable]=useState(false);
  const id=useId();

  useEffect(()=>{
    let mounted=true;
    publicApi.publishedCategories().then(response=>{
      if(!mounted)return;
      if(!response||!Array.isArray(response.categories)) throw new Error("Invalid public catalogue categories.");
      const seen=new Set<string>();
      setCategories(response.categories.filter(item=>{
        if(!item||typeof item.slug!=="string"||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)
          ||typeof item.name!=="string"||!item.name.trim()||seen.has(item.slug))return false;
        seen.add(item.slug);return true;
      }));
      setUnavailable(false);
    }).catch(()=>{if(mounted){setCategories([]);setUnavailable(true);}});
    return ()=>{mounted=false;};
  },[]);
  const active=pathname===routes.client.services||pathname.startsWith("/client/services/")
    ||pathname.startsWith("/client/order");
  return <li className="min-w-0">
    <NavRoot href={routes.client.services} label="Services" icon={PackageCheck}
      active={active} onNavigate={onNavigate} expanded={expanded}
      onExpand={()=>setExpanded(v=>!v)} controls={id}/>
    {expanded?<ul id={id} className="ml-7 mt-1 space-y-0.5 border-l border-white/15 pl-2">
      <NavChild href={routes.client.services} label="My Services" pathname={pathname} onNavigate={onNavigate}/>
      <NavChild href={routes.client.order} label="Order New Service" pathname={pathname} onNavigate={onNavigate}/>
      {categories.map(item=><NavChild key={item.slug} href={routes.client.order+"?category="+encodeURIComponent(item.slug)}
        label={item.name} pathname={pathname} onNavigate={onNavigate}/>)}
      {unavailable?<li className="px-3 py-1 text-xs text-slate-400">
        Categories temporarily unavailable
      </li>:null}
    </ul>:null}
  </li>;
}

export function ClientDomainsNavigation({pathname,onNavigate}:{
  pathname:string;onNavigate:()=>void;
}){
  const [expanded,setExpanded]=useState(true);
  const id=useId();
  const active=pathname===routes.client.domains||pathname.startsWith("/client/domains/");
  return <li>
    <NavRoot href={routes.client.domains} label="Domains" icon={Globe2}
      active={active} onNavigate={onNavigate} expanded={expanded}
      onExpand={()=>setExpanded(v=>!v)} controls={id}/>
    {expanded?<ul id={id} className="ml-7 mt-1 space-y-0.5 border-l border-white/15 pl-2">
      <NavChild href={routes.client.domains} label="My Domains" pathname={pathname} onNavigate={onNavigate}/>
      <NavChild href={routes.client.domainRegister} label="Register New Domain" pathname={pathname} onNavigate={onNavigate}/>
      <NavChild href={routes.client.domainTransfer} label="Transfer Domain to Us" pathname={pathname} onNavigate={onNavigate}/>
    </ul>:null}
  </li>;
}
