"use client";
import {useRef,type KeyboardEvent} from "react";
import {ServerCog,Layers,PackagePlus,ClipboardCheck} from "lucide-react";
import {catalogTabs,type CatalogSection} from "./catalogue-types";
const icons={suppliers:ServerCog,products:Layers,plans:PackagePlus,publish:ClipboardCheck} as const;
type Props={active:CatalogSection;onSelect:(tab:CatalogSection)=>void};
export function CatalogWorkspaceNavigation({active,onSelect}:Props){
 const refs=useRef<Array<HTMLButtonElement|null>>([]);
 function keyDown(e:KeyboardEvent<HTMLButtonElement>,index:number){
  const delta=e.key==="ArrowRight"?1:e.key==="ArrowLeft"?-1:0;
  if(delta===0&&e.key!=="Home"&&e.key!=="End")return;
  e.preventDefault();
  const next=e.key==="Home"?0:e.key==="End"?catalogTabs.length-1:
   (index+delta+catalogTabs.length)%catalogTabs.length;
  onSelect(catalogTabs[next].key);refs.current[next]?.focus();
 }
 return <div role="tablist" aria-label="Hosting catalogue sections" className="grid min-w-0 grid-cols-2 gap-2 rounded-2xl border border-console-line bg-white p-2 shadow-sm xl:grid-cols-4">
  {catalogTabs.map((tab,index)=>{
   const Icon=icons[tab.key],selected=active===tab.key;
   return <button key={tab.key} id={`catalog-tab-${tab.key}`} role="tab"
    type="button" tabIndex={selected?0:-1} aria-selected={selected}
    aria-controls={`catalog-panel-${tab.key}`}
    ref={node=>{refs.current[index]=node;}}
    onKeyDown={e=>keyDown(e,index)} onClick={()=>onSelect(tab.key)}
    className={`flex min-h-20 min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary focus-visible:ring-offset-2 sm:px-4 ${selected?"bg-console-primary text-white shadow-md":"text-console-muted hover:bg-slate-50"}`}>
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected?"bg-white/20 text-white":"bg-blue-50 text-console-primary"}`}><Icon aria-hidden="true" className="h-5 w-5"/></span>
    <span className="min-w-0"><span className="block text-xs font-bold leading-5 sm:text-sm">{tab.label}</span><span className={`mt-0.5 hidden text-[11px] leading-4 sm:block ${selected?"text-blue-100":"text-console-muted"}`}>{tab.caption}</span></span>
   </button>;
  })}
 </div>;
}
