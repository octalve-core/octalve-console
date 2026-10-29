"use client";
import {useState} from "react";
import styles from "./AdminReportsWorkspace.module.css";
import type {LucideIcon} from "lucide-react";
import {
 BarChart3,CheckCircle2,CreditCard,FileBarChart2,
 FileText,Info,Layers3,RefreshCw,ShieldCheck,WalletCards,
} from "lucide-react";
import {DashboardShell} from "@/components/layout/DashboardShell";
import {DashboardPage} from "@/components/layout/DashboardPage";
import {Panel} from "@/components/design-system/Panel";
import {ActionButton} from "@/components/design-system/ActionButton";
import {StatusBadge,type StatusTone} from "@/components/design-system/StatusBadge";
import {ConsoleIconTile} from "@/components/design-system/ConsoleIconTile";
import {AdaptiveSheet} from "@/components/design-system/AdaptiveSheet";
import {LoadingState} from "@/components/feedback/LoadingState";
import {ErrorState} from "@/components/feedback/ErrorState";
import {useAutoSync} from "@/lib/hooks/useAutoSync";
import {reportsApi} from "@/lib/api/modules/reports.api";
import {
 parsePaidInvoiceCount,parseGatewayCounts,parseProductCounts,parseDefinitions,parseInstances,
 type CategoryCount,type ReportDefinitionCard,type ReportInstanceCard,
} from "../lib/report-presentation";

type ReportSection="overview"|"library"|"history";
type ReportState={
 paidInvoiceCount:number|null;
 gateways:CategoryCount[]|null;
 products:CategoryCount[]|null;
 definitions:ReportDefinitionCard[]|null;
 instances:ReportInstanceCard[]|null;
};
const initial:ReportState={paidInvoiceCount:null,gateways:null,products:null,definitions:null,instances:null};
const reportSections:readonly {key:ReportSection;title:string}[]=[
 {key:"overview",title:"Overview"},{key:"library",title:"Report library"},{key:"history",title:"Generated reports"},
];
function SummaryCard({title,value,help,icon,tone}:{
 title:string;value:string;help:string;icon:LucideIcon;tone:"blue"|"green"|"amber"|"violet";
}){
 return <Panel className="flex min-h-[10rem] min-w-0 flex-col justify-between gap-4">
  <div className="flex min-w-0 items-start justify-between gap-3">
   <div className="min-w-0"><h2 className="text-xs font-medium leading-5 text-console-muted">{title}</h2>
    <p className="mt-3 break-words text-2xl font-medium tracking-tight text-console-ink">{value}</p>
   </div>
   <ConsoleIconTile icon={icon} tone={tone}/>
  </div>
  <p className="text-xs leading-5 text-console-muted">{help}</p>
 </Panel>;
}
function CountsBreakdown({title,description,rows,tone,unit}:{
 title:string;description:string;rows:CategoryCount[]|null;tone:"blue"|"green";unit:string;
}){
 const max=rows&&rows.length?Math.max(1,...rows.map(r=>r.count)):1;
 const top=rows?.slice(0,7)??[];
 return <Panel className="min-w-0">
  <div className="flex items-start gap-3">
   <ConsoleIconTile icon={tone==="blue"?CreditCard:Layers3} tone={tone}/>
   <div className="min-w-0">
    <h2 className="text-base font-medium tracking-tight text-console-ink">{title}</h2>
    <p className="mt-1 text-xs leading-5 text-console-muted">{description}</p>
   </div>
  </div>
  {rows===null?
   <p role="status" className="mt-7 rounded-xl bg-slate-50 px-4 py-6 text-sm text-console-muted">This breakdown is not available right now.</p>
  :top.length===0?
   <p className="mt-7 rounded-xl bg-slate-50 px-4 py-6 text-sm text-console-muted">No qualifying records in the last 30 days.</p>
  :<div className="mt-6 space-y-5" role="list" aria-label={title}>
    {top.map((item,i)=><div role="listitem" key={item.label+"-"+i} className="min-w-0">
     <div className="mb-2 flex min-w-0 items-start justify-between gap-3 text-sm">
      <span className="min-w-0 break-words font-medium text-console-ink">{item.label}</span>
      <span className="shrink-0 text-xs font-medium tabular-nums text-console-ink">{item.count.toLocaleString("en-NG")} {unit}</span>
     </div>
     <div role="img" aria-label={item.label+": "+item.count+" "+unit}
       className="h-2.5 overflow-hidden rounded-full bg-slate-100">
      <div className={"h-full rounded-full "+(tone==="blue"?"bg-console-primary":"bg-emerald-600")}
        style={{width:(max===0?0:Math.max(0,Math.min(100,item.count/max*100)))+"%"}}/>
     </div>
    </div>)}
    {rows.length>top.length?<p className="text-xs text-console-muted">Showing the seven largest categories of {rows.length}.</p>:null}
   </div>}
 </Panel>;
}
function friendlyDate(value:string|null){
 if(!value)return "Not recorded";
 const d=new Date(value);
 return Number.isNaN(d.getTime())?"Date unavailable":new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(d);
}
function instanceTone(status:string):StatusTone{
 switch(status.toLowerCase()){
  case "completed":return "success";
  case "failed":return "error";
  case "processing":return "info";
  case "pending":return "warning";
  default:return "neutral";
 }
}
function ReportLibrary({definitions}:{definitions:ReportDefinitionCard[]|null}){
 if(definitions===null)return <ErrorState title="Report library unavailable"
  description="We couldn't retrieve your report definitions. Other report sections may still be available."/>;
 if(!definitions.length)return <Panel><p className="text-sm text-console-muted">No report definitions have been published yet.</p></Panel>;
 return <section className={styles.library} aria-label="Available report definitions">
  {definitions.map((report,index)=><Panel key={report.id} className="flex min-w-0 flex-col gap-5">
   <div className="flex items-start justify-between gap-3">
    <ConsoleIconTile icon={index%2?BarChart3:FileBarChart2} tone={index%2?"violet":"blue"}/>
    <StatusBadge tone={report.active===true?"success":"neutral"}>{report.active===null?"Status unavailable":report.active?"Active":"Inactive"}</StatusBadge>
   </div>
   <div className="min-w-0"><h2 className="break-words text-base font-medium text-console-ink">{report.name}</h2>
    <p className="mt-2 text-sm leading-6 text-console-muted">{report.description}</p>
   </div>
   <div className="mt-auto flex items-center justify-between gap-3 border-t border-console-line pt-4 text-xs text-console-muted">
    <span className="break-words">{report.kind} · {report.frequency}</span>
   </div>
   <p className="text-xs text-console-muted">Last generated: {friendlyDate(report.lastGenerated)}</p>
  </Panel>)}
 </section>;
}
function ReportHistory({instances}:{instances:ReportInstanceCard[]|null}){
 if(instances===null)return <ErrorState title="Generated reports unavailable"
  description="We couldn't retrieve the generated-report history."/>;
 if(!instances.length)return <Panel><p className="text-sm text-console-muted">No generated reports are recorded yet.</p></Panel>;
 return <section className={styles.history} aria-label="Generated report history">
  {instances.map(row=><Panel key={row.id} className="flex min-w-0 flex-col gap-4">
   <div className="flex items-start justify-between gap-3">
    <ConsoleIconTile icon={FileText} tone="blue"/>
    <StatusBadge tone={instanceTone(row.status)}>{row.status.replace(/_/g," ")}</StatusBadge>
   </div>
   <h2 className="min-w-0 break-words text-base font-medium text-console-ink">{row.title}</h2>
   <div className="flex flex-wrap items-center justify-between gap-2 border-t border-console-line pt-3 text-xs text-console-muted">
    <span>{row.format.toUpperCase()}</span>
    <span>{friendlyDate(row.generatedAt)}</span>
   </div>
  </Panel>)}
 </section>;
}
export function AdminReportsWorkspaceView(){
 const [section,setSection]=useState<ReportSection>("overview");
 const [data,setData]=useState<ReportState>(initial);
 const [loading,setLoading]=useState(true);
 const [errors,setErrors]=useState<string[]>([]);
 const [methodologyOpen,setMethodologyOpen]=useState(false);
 async function load(quiet=false){
  if(!quiet)setLoading(true);
  const requests=[
   reportsApi.revenueSummary({period:"day"}),
   reportsApi.revenueByGateway(),reportsApi.revenueByProduct(),
   reportsApi.definitions(),reportsApi.instances(),
  ] as const;
  const results=await Promise.allSettled(requests);
  const convert=<T,>(index:number,name:string,parser:(source:unknown)=>T):T|null=>{
   const outcome=results[index];
   try {
    if(outcome.status!=="fulfilled")throw new Error("Report data unavailable");
    return parser(outcome.value);
   }catch{unavailable.push(name);return null;}
  };
  const unavailable:string[]=[];
  const next:ReportState={
   paidInvoiceCount:convert(0,"Paid invoices",parsePaidInvoiceCount),
   gateways:convert(1,"Payment gateways",parseGatewayCounts),
   products:convert(2,"Invoice items",parseProductCounts),
   definitions:convert(3,"Report definitions",parseDefinitions),
   instances:convert(4,"Generated reports",parseInstances),
  };
  setData(next);setErrors(unavailable);setLoading(false);
 }
 useAutoSync(load,"admin-report-workspace");
 const numbers=[
  {title:"Paid invoices",value:data.paidInvoiceCount===null?"—":data.paidInvoiceCount.toLocaleString("en-NG"),help:"Paid invoice records · last 30 days",icon:FileText,tone:"blue" as const},
  {title:"Gateway categories",value:data.gateways===null?"—":String(data.gateways.length),help:"Gateways with successful transactions · last 30 days",icon:WalletCards,tone:"green" as const},
  {title:"Invoiced item categories",value:data.products===null?"—":String(data.products.length),help:"Item descriptions on paid invoices · last 30 days",icon:Layers3,tone:"amber" as const},
  {title:"Report definitions",value:data.definitions===null?"—":String(data.definitions.length),help:"Definitions available to this account",icon:BarChart3,tone:"violet" as const},
 ];
 return <DashboardShell role="admin" title="Reports" description="Explore reporting activity and financial records.">
  <DashboardPage eyebrow="Insights" title="Reports" description="Clear business reporting, using the records available to your account."
   actions={<div className="flex flex-wrap items-center gap-2">
    <ActionButton variant="outline" size="sm" onClick={()=>setMethodologyOpen(true)}
      leadingIcon={<Info className="h-4 w-4" aria-hidden="true"/>}>About these figures</ActionButton>
    <ActionButton variant="primary" size="sm" onClick={()=>void load(false)} disabled={loading}
      leadingIcon={<RefreshCw className="h-4 w-4" aria-hidden="true"/>}>Refresh</ActionButton>
   </div>}>
   {loading?<LoadingState title="Preparing reports" description="Retrieving available report information."/>:
   <div className="min-w-0 space-y-6">
    <nav aria-label="Report sections" className="flex min-w-0 gap-2 overflow-x-auto border-b border-console-line pb-3">
     {reportSections.map(item=><button key={item.key} type="button"
       aria-pressed={section===item.key} onClick={()=>setSection(item.key)}
       className={"min-h-11 shrink-0 rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary "+
       (section===item.key?"bg-console-primary text-white":"bg-white text-console-muted hover:bg-slate-100")}>{item.title}</button>)}
    </nav>
    {errors.length?<div role="status" className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"/>
      <span>Some report information is currently unavailable: {errors.join(", ")}. Available sections show only retrieved records.</span>
    </div>:null}
    {section==="overview"?<>
     <section aria-label="Report metrics" className={styles.metrics}>
      {numbers.map(item=><SummaryCard key={item.title} {...item}/>)}
     </section>
     <div className={styles.breakdowns}>
      <CountsBreakdown title="Successful payments by gateway"
       description="Number of successful transaction records grouped by gateway during the last 30 days. Amounts are not added across currencies."
       unit="transactions" rows={data.gateways} tone="blue"/>
      <CountsBreakdown title="Paid invoice items by description"
       description="Number of item records attached to paid invoices during the last 30 days. Items are not invoices or received payments."
       unit="items" rows={data.products} tone="green"/>
     </div>
     <Panel className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
      <ConsoleIconTile icon={ShieldCheck} tone="slate"/>
      <div className="min-w-0"><h2 className="text-sm font-medium text-console-ink">Financial reporting integrity</h2>
       <p className="mt-2 text-sm leading-6 text-console-muted">
        Counts are taken from Console's reporting API. Revenue amount totals are withheld here because the current aggregation does not separate currencies. Invoice status is not proof of bank settlement or provider provisioning.
       </p>
      </div>
     </Panel>
    </>:section==="library"?<ReportLibrary definitions={data.definitions}/>:
       <ReportHistory instances={data.instances}/>}
   </div>}
   <AdaptiveSheet open={methodologyOpen} onClose={()=>setMethodologyOpen(false)}
    title="Understanding report figures" description="The numbers on this screen come from Octalve Console, not Invoice preview records.">
    <div className="space-y-4 text-sm leading-6 text-console-muted">
     <p><strong className="text-console-ink">Timeframe:</strong> Paid invoice counts and the two category charts use their reporting endpoints' rolling 30-day windows. Library and generated report records are separate lists.</p>
     <p><strong className="text-console-ink">Financial amounts:</strong> Reports cannot combine different currencies into one meaningful total. A currency-scoped ledger and reconciliation evidence are required before enabling monetary charts or export.</p>
     <p><strong className="text-console-ink">Availability:</strong> A dash means the relevant data could not be verified. A genuine zero is shown as zero. Missing data is never fabricated.</p>
     <p><strong className="text-console-ink">Actions:</strong> This page does not generate, delete, export, or post reports. Existing Django permissions and approval workflows remain authoritative.</p>
    </div>
    <ActionButton variant="primary" className="mt-6 w-full" onClick={()=>setMethodologyOpen(false)}
     leadingIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true"/>}>Understood</ActionButton>
   </AdaptiveSheet>
  </DashboardPage>
 </DashboardShell>;
}
