"use client";
import {useEffect,useRef,useState} from "react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {LoadingState} from "@/components/feedback/LoadingState";
import {ErrorState} from "@/components/feedback/ErrorState";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import {useAuth} from "@/context/AuthContext";
import {useAutoSync} from "@/lib/hooks/useAutoSync";
import {privateQueryKey,privateQueryRead,privateQueryWrite} from "@/lib/api/private-query-cache";
import {reportsApi} from "@/lib/api/modules/reports.api";
import {parseDefinitions,parseInstances,
 type ReportDefinitionCard,type ReportInstanceCard} from "../lib/report-presentation";
import {parseBIZSnapshot,type BIZSnapshot} from "./contracts";
import {OverviewPanel,FinancePanel,CustomersPanel,RenewalsPanel,ProvidersPanel,LibraryPanel} from "./BusinessPanels";

type Section="overview"|"finance"|"customers"|"renewals"|"providers"|"library";
const sections:readonly {key:Section;label:string}[]=[
 {key:"overview",label:"Overview"},{key:"finance",label:"Finance"},
 {key:"customers",label:"Customers"},{key:"renewals",label:"Renewals"},
 {key:"providers",label:"Providers"},{key:"library",label:"Report Library"},
];
const CURRENCIES=["NGN","USD","GBP","EUR","CAD"] as const;
/** One request per BI snapshot, not five blocking requests on every route visit.
 * Read cache holds only short-lived presentation data scoped to user and currency.
 * The server reauthorizes EVERY GET and has no shared response cache.
 */
export function BusinessIntelligenceView(){
 const {user}=useAuth();
 const [currency,setCurrency]=useState("NGN");
 const [section,setSection]=useState<Section>("overview");
 const scope=user?.role==="admin"?privateQueryKey("biz02-snapshot",user.id,user.role,{currency}):"";
 const activeScope=useRef(scope);activeScope.current=scope;
 const [snapshot,setSnapshot]=useState<BIZSnapshot|null>(null);
 const [loadedScope,setLoadedScope]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [library,setLibrary]=useState<{definitions:ReportDefinitionCard[];instances:ReportInstanceCard[]}|null>(null);
 const [libraryScope,setLibraryScope]=useState("");
 const [libraryLoading,setLibraryLoading]=useState(false);
 const [libraryError,setLibraryError]=useState("");
 const libraryKey=user?.role==="admin"?privateQueryKey("biz02-library",user.id,user.role,{}):"";
 const activeLibrary=useRef(libraryKey);activeLibrary.current=libraryKey;

 async function load(quiet:boolean){
  if(!scope){setSnapshot(null);setLoadedScope("");setLoading(false);return;}
  const cached=privateQueryRead<BIZSnapshot>(scope,15000);
  if(cached?.fresh){
   if(activeScope.current!==scope)return;
   setSnapshot(cached.value);setLoadedScope(scope);setLoading(false);setError("");
   return;
  }
  if(!quiet&&loadedScope!==scope)setLoading(true);
  try{
   const result=parseBIZSnapshot(await reportsApi.businessSnapshot(currency));
   if(activeScope.current!==scope)return;
   if(result.currency!==currency)throw Error("Report currency does not match the selected scope.");
   privateQueryWrite(scope,result);
   setSnapshot(result);setLoadedScope(scope);setError("");
  }catch{
   if(activeScope.current===scope)setError("We could not verify the latest report data. Existing figures, if shown, may be out of date.");
  }finally{
   if(activeScope.current===scope)setLoading(false);
  }
 }
 useAutoSync(load,"biz02:"+scope,30000);
 useEffect(()=>{
  if(section!=="library"||!libraryKey)return;
  let active=true;
  const cache=privateQueryRead<{definitions:ReportDefinitionCard[];instances:ReportInstanceCard[]}>(libraryKey,30000);
  if(cache?.fresh){
   setLibrary(cache.value);setLibraryScope(libraryKey);setLibraryError("");setLibraryLoading(false);
   return()=>{active=false;};
  }
  setLibraryLoading(true);
  void Promise.all([reportsApi.definitions(),reportsApi.instances()]).then(([definitions,instances])=>{
   const value={definitions:parseDefinitions(definitions),instances:parseInstances(instances)};
   if(!active||activeLibrary.current!==libraryKey)return;
   privateQueryWrite(libraryKey,value);setLibrary(value);setLibraryScope(libraryKey);setLibraryError("");
  }).catch(()=>{
   if(active&&activeLibrary.current===libraryKey)setLibraryError("Report definitions or history are temporarily unavailable.");
  }).finally(()=>{if(active&&activeLibrary.current===libraryKey)setLibraryLoading(false);});
  return()=>{active=false;};
 },[section,libraryKey]);
 const data=loadedScope===scope&&scope?snapshot:null;
 const libraryData=libraryScope===libraryKey?library:null;
 return <DashboardShell role="admin" title="Business Intelligence"
  description="Understand your business performance.">
  <DashboardPage eyebrow="Business Intelligence" title="Know your business. Grow with clarity."
   description="Track payments, customer growth, renewals and provider performance in one place.">
   <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-console-line bg-white px-4 py-3 shadow-sm">
     <div className="flex flex-wrap items-center gap-2">
      <StatusBadge tone="info">Single-currency reporting</StatusBadge>
      <span className="text-xs text-console-muted">
       {data?"As of "+new Date(data.as_of).toLocaleString("en-GB"):"Awaiting verified data"}
      </span>
     </div>
     <label className="flex items-center gap-3 text-xs font-medium text-console-ink">
      Currency
      <select aria-label="Report currency" value={currency} onChange={e=>setCurrency(e.target.value)}
       className="h-10 rounded-lg border border-console-line bg-white px-3 text-sm text-console-ink focus-visible:outline-2 focus-visible:outline-console-primary">
       {CURRENCIES.map(value=><option key={value} value={value}>{value}</option>)}
      </select>
     </label>
    </div>
    <nav aria-label="Business Intelligence workspaces" className="flex min-w-0 gap-1.5 overflow-x-auto border-b border-console-line pb-3">
     {sections.map(tab=><button key={tab.key} type="button" onClick={()=>setSection(tab.key)}
      aria-current={section===tab.key?"page":undefined}
      className={"min-h-11 shrink-0 rounded-xl px-3.5 text-sm font-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-console-primary "+
       (section===tab.key?"bg-console-primary text-white":"bg-white text-console-muted hover:bg-slate-100")}>{tab.label}</button>)}
    </nav>
    {error?<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p>:null}
    {section==="library"?
     <LibraryPanel definitions={libraryData?.definitions??null} instances={libraryData?.instances??null}
      loading={libraryLoading} error={libraryError}/>
    :loading&&!data?<LoadingState title="Preparing your business overview"
       description="Checking the latest records available to your account."/>
    :!data?<ErrorState title="Reports unavailable" description="We could not verify these records at the moment."/>
    :section==="overview"?<OverviewPanel data={data}/>
    :section==="finance"?<FinancePanel data={data}/>
    :section==="customers"?<CustomersPanel data={data}/>
    :section==="renewals"?<RenewalsPanel data={data}/>
    :<ProvidersPanel data={data}/>}
   </div>
  </DashboardPage>
 </DashboardShell>;
}
