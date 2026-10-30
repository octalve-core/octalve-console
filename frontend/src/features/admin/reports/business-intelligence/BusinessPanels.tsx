import type {LucideIcon} from "lucide-react";
import {MetricKpiCard,metricTrend,type MetricKpiTrend} from "@/components/design-system/MetricKpiCard";
import {MonthlyPaymentsChart,RegistrationTrendChart,InvoiceStatusChart} from "./InsightCharts";
import Link from "next/link";
import {Activity,CalendarClock,CircleDollarSign,CreditCard,FileCheck2,
 Globe2,Layers3,ReceiptText,ShieldCheck,TrendingUp,Users2,WalletCards} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {ConsoleIconTile} from "@/components/design-system/ConsoleIconTile";
import {ResponsiveTable,type ResponsiveColumn} from "@/components/design-system/ResponsiveTable";
import type {BIZSnapshot,MonthlyCount,MonthlyMoney} from "./contracts";
import {formatMoney,monthLabel} from "./contracts";
import type {ReportDefinitionCard,ReportInstanceCard} from "../lib/report-presentation";

const fmt=(n:number)=>n.toLocaleString("en-NG");
type Tone="blue"|"green"|"amber"|"violet"|"rose"|"slate";
function KPIs({items}:{items:readonly {title:string;value:string;note:string;icon:LucideIcon;tone?:Tone;trend?:MetricKpiTrend}[]}){
 return <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map(item=><MetricKpiCard key={item.title} {...item}/>)}</div>;
}
function Explanation({title,body,warning=false}:{title:string;body:string;warning?:boolean}){
 return <Panel className={warning?"border-amber-200 bg-amber-50/40":""}>
  <div className="flex items-start gap-3"><ConsoleIconTile icon={warning?ShieldCheck:Activity} tone={warning?"amber":"slate"} size="sm"/>
   <div><h2 className="text-sm font-medium text-console-ink">{title}</h2>
    <p className="mt-1 text-xs leading-6 text-console-muted">{body}</p></div>
  </div>
 </Panel>;
}
function Bars({title,rows}:{title:string;rows:readonly MonthlyCount[]}){
 const max=Math.max(1,...rows.map(x=>x.count));
 return <Panel><h2 className="mb-5 text-sm font-medium text-console-ink">{title}</h2>
  {rows.length===0?<p className="text-sm text-console-muted">No qualifying activity in the selected period.</p>:
   <div className="space-y-4">{rows.slice(-12).map(x=><div key={x.month}>
    <div className="mb-1 flex justify-between gap-3 text-xs text-console-muted">
     <span>{monthLabel(x.month)}</span><span className="font-medium tabular-nums text-console-ink">{fmt(x.count)}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="img"
      aria-label={monthLabel(x.month)+": "+fmt(x.count)}>
     <div className="h-full rounded-full bg-console-primary" style={{width:String(100*x.count/max)+"%"}}/>
    </div>
   </div>)}</div>}
 </Panel>;
}
export function OverviewPanel({data}:{data:BIZSnapshot}){
 const x=data.overview,c=data.currency;
 return <div className="space-y-5">
  <KPIs items={[
   {title:"Verified payment records · this month",value:formatMoney(x.payment_amounts.this_month,c),note:"Gateway webhook verified; bank settlement not established",icon:WalletCards,tone:"blue"},
   {title:"Verified payment records · last month",value:formatMoney(x.payment_amounts.last_month,c),note:"Same currency and verification rule",icon:TrendingUp,tone:"violet"},
   {title:"Verified payment records · this year",value:formatMoney(x.payment_amounts.year_to_date,c),note:"Year to date; not accounting profit",icon:CircleDollarSign,tone:"green"},
   {title:"New customers · this month",value:fmt(x.new_customers_this_month),note:"Compared with the prior calendar month",icon:Users2,tone:"amber",trend:metricTrend(x.new_customers_this_month,data.customers.registered_last_month)},
   {title:"Paid invoice records · this month",value:fmt(x.paid_invoices_this_month),note:"Invoice state; not settlement evidence",icon:FileCheck2},
   {title:"Invoices awaiting resolution",value:fmt(x.pending_invoices),note:"Unpaid, partially paid and overdue",icon:ReceiptText,tone:"amber"},
   {title:"Active service records",value:fmt(x.active_services),note:"Local service lifecycle state",icon:Layers3,tone:"violet"},
   {title:"Paid renewal invoices · this month",value:fmt(x.paid_renewal_invoices_this_month),note:"Tagged renewal invoices, based on status",icon:CalendarClock,tone:"green"},
  ]}/>
  <div className="grid min-w-0 gap-4 xl:grid-cols-[1.6fr_1fr]">
   <MonthlyPaymentsChart rows={data.finance.payment_months} currency={data.currency}/>
   <InvoiceStatusChart statuses={data.finance.invoice_status}/>
  </div>
  <div className="grid min-w-0 gap-4 xl:grid-cols-[1.6fr_1fr]">
   <RegistrationTrendChart rows={data.customers.registrations_by_month}/>
   <Panel><h2 className="text-sm font-medium text-console-ink">Requires your attention</h2>
    <div className="mt-4 space-y-4 text-sm"><Link href="/admin/billing/invoices" className="flex items-center justify-between gap-3 border-b border-console-line pb-4 text-console-ink hover:text-console-primary">
     <span>Invoices awaiting payment</span><span className="font-medium tabular-nums">{fmt(x.pending_invoices)}</span></Link>
     <Link href="/admin/billing/services" className="flex items-center justify-between gap-3 border-b border-console-line pb-4 text-console-ink hover:text-console-primary"><span>Services due within 30 days</span><span className="font-medium tabular-nums">{fmt(data.renewals.services_due_in_30_days)}</span></Link>
     <Link href="/admin/billing/domains" className="flex items-center justify-between gap-3 text-console-ink hover:text-console-primary"><span>Domains nearing expiry</span><span className="font-medium tabular-nums">{fmt(data.renewals.domains_expiring_in_30_days)}</span></Link>
    </div></Panel>
  </div>
  <Explanation warning title="Interpreting your business performance"
   body="All payment figures here come from successful payment records with verified webhooks and are scoped to one currency. Bank settlement, provider fulfilment, supplier costs and accounting profit must be reconciled separately."/>
 </div>;
}
export function FinancePanel({data}:{data:BIZSnapshot}){
 const x=data.finance,c=data.currency;
 const invoiceRows=Object.entries(x.invoice_status).map(([status,count])=>({status,count})).sort((a,b)=>b.count-a.count);
 const invoiceColumns:ResponsiveColumn<typeof invoiceRows[number]>[]=[
  {key:"status",heading:"Invoice status",cell:r=>r.status.replace(/_/g," ")},
  {key:"count",heading:"Records",cell:r=>fmt(r.count)}];
 const paymentColumns:ResponsiveColumn<MonthlyMoney>[]=[
  {key:"month",heading:"Month",cell:r=>monthLabel(r.month)},
  {key:"count",heading:"Verified payments",cell:r=>fmt(r.count)},
  {key:"amount",heading:"Amount · "+c,cell:r=>formatMoney(r.amount,c)}];
 return <div className="space-y-5">
  <KPIs items={[
   {title:"This month · gateway verified",value:formatMoney(x.payment_amounts.this_month,c),note:"Not bank-settled revenue",icon:CircleDollarSign},
   {title:"Verified payment records",value:fmt(data.overview.verified_payment_count_this_month),note:"Month to date vs previous full calendar month",icon:CreditCard,tone:"green",trend:metricTrend(data.overview.verified_payment_count_this_month,data.overview.verified_payment_count_last_month)},
   {title:"Last month · gateway verified",value:formatMoney(x.payment_amounts.last_month,c),note:"Direct month-to-month basis",icon:TrendingUp,tone:"violet"},
   {title:"Paid on/before invoice due date",value:fmt(x.paid_before_due_this_month),note:"Invoice timestamps only",icon:FileCheck2,tone:"green"},
   {title:"Paid after invoice due date",value:fmt(x.paid_after_due_this_month),note:"Invoice timestamps only",icon:CalendarClock,tone:"amber"},
  ]}/>
  <div className="grid min-w-0 gap-4 xl:grid-cols-2">
   <Panel><h2 className="mb-4 text-sm font-medium">Invoice pipeline</h2>
    <ResponsiveTable caption="Invoices grouped by recorded status" rows={invoiceRows} columns={invoiceColumns}
      getRowKey={r=>r.status} emptyDescription="No invoice records for this currency."/></Panel>
   <InvoiceStatusChart statuses={x.invoice_status}/>
  </div>
  <MonthlyPaymentsChart rows={x.payment_months} currency={c}/>
  <Panel><h2 className="mb-4 text-sm font-medium">Gateway-verified payment history</h2>
   <ResponsiveTable caption="Gateway verified payments by month" rows={x.payment_months}
     columns={paymentColumns} getRowKey={r=>r.month} emptyDescription="No verified payment records in this period."/></Panel>
  <Explanation warning title="Payment and profit qualification" body="Successful gateway evidence does not prove bank settlement. Invoice paid status is separate; supplier cost and actual profit are deliberately not calculated. Currencies are never combined or converted implicitly."/>
 </div>;
}
export function CustomersPanel({data}:{data:BIZSnapshot}){
 const c=data.customers;
 const cols:ResponsiveColumn<MonthlyCount>[]=[
  {key:"month",heading:"Registration month",cell:r=>monthLabel(r.month)},
  {key:"count",heading:"Customer registrations",cell:r=>fmt(r.count)}];
 return <div className="space-y-5">
  <KPIs items={[
   {title:"Registered customer accounts",value:fmt(c.registered_total),note:"Customer accounts",icon:Users2},
   {title:"New accounts · this month",value:fmt(c.registered_this_month),note:"Month to date versus previous month",icon:TrendingUp,tone:"green",trend:metricTrend(c.registered_this_month,c.registered_last_month)},
   {title:"New accounts · last month",value:fmt(c.registered_last_month),note:"Previous calendar month",icon:CalendarClock,tone:"violet"},
   {title:"Paying customers · this month",value:fmt(c.paying_customers_this_month),note:"Distinct clients with a webhook-verified payment in this currency",icon:CreditCard,tone:"amber"},
  ]}/>
  <div className="grid min-w-0 gap-4 xl:grid-cols-2">
   <Panel><h2 className="text-sm font-medium text-console-ink">Customer accounts to review</h2>
    <div className="mt-4 space-y-4 text-sm">
     <div className="flex items-center justify-between gap-3 border-b border-console-line pb-4">
      <span>Two or more failed payment attempts in 14 days</span>
      <span className="font-medium tabular-nums">{fmt(c.accounts_with_repeat_failed_payments_14d)}</span>
     </div>
     <div className="flex items-center justify-between gap-3">
      <span>Active service records past their renewal date</span>
      <span className="font-medium tabular-nums">{fmt(c.accounts_with_past_due_services)}</span>
     </div>
    </div>
    <p className="mt-4 text-xs leading-5 text-console-muted">These are review signals, not fraud findings. Verify the underlying account and transaction history before acting.</p>
   </Panel>
  </div>
  <div className="grid min-w-0 gap-4 xl:grid-cols-2">
   <RegistrationTrendChart rows={c.registrations_by_month}/>
   <Panel><h2 className="mb-4 text-sm font-medium">Customer registration records</h2>
    <ResponsiveTable caption="Customer cohorts by registration month" rows={c.registrations_by_month}
     columns={cols} getRowKey={r=>r.month}/></Panel>
  </div>
 </div>;
}
export function RenewalsPanel({data}:{data:BIZSnapshot}){
 const r=data.renewals;
 return <div className="space-y-5">
  <KPIs items={[
   {title:"Services due in 7 days",value:fmt(r.services_due_in_7_days),note:"Active service renewal dates",icon:CalendarClock,tone:"amber"},
   {title:"Services due in 30 days",value:fmt(r.services_due_in_30_days),note:"Includes the coming seven days",icon:Layers3},
   {title:"Past-due active services",value:fmt(r.services_past_due),note:"Local service record; review before action",icon:Activity,tone:"rose"},
   {title:"Domains expiring in 30 days",value:fmt(r.domains_expiring_in_30_days),note:"Active domain records only",icon:Globe2,tone:"violet"},
   {title:"Paid renewal invoices this month",value:fmt(r.paid_renewal_invoices_this_month),note:"Recorded renewal invoice state",icon:FileCheck2,tone:"green"},
  ]}/>
  <Explanation title="Renewal actions need live verification"
   body="A due or expiry date is an operational alert. Automatic renewal, supplier confirmation, actual payment settlement and service activation require their own server-authorized workflows."/>
 </div>;
}
export function ProvidersPanel({data}:{data:BIZSnapshot}){
 const p=data.providers;
 type ProviderRow=typeof p.distribution[number];
 const cols:ResponsiveColumn<ProviderRow>[]=[
  {key:"provider",heading:"Provider",cell:r=>r.name},
  {key:"services",heading:"Active service records",cell:r=>fmt(r.active_services)}];
 return <div className="space-y-5">
  <KPIs items={[
   {title:"Active services linked to providers",value:fmt(p.active_services_with_provider),note:"Local records; not remote inventory",icon:Layers3},
   {title:"Validated supplier costs",value:"Not available",note:"Supplier cost evidence not qualified",icon:WalletCards,tone:"amber"},
   {title:"Verified profit / margin",value:"Not available",note:"No reconciled gross-margin basis",icon:TrendingUp,tone:"slate"},
  ]}/>
  <Panel><h2 className="mb-4 text-sm font-medium">Provider distribution</h2>
   <ResponsiveTable caption="Top providers by active local service records"
    rows={p.distribution} columns={cols} getRowKey={r=>r.id}
    emptyDescription="No active services linked to a provider."/></Panel>
  <Explanation warning title="Why margin is withheld" body={p.note}/>
 </div>;
}
export function LibraryPanel({definitions,instances,loading,error}:{definitions:ReportDefinitionCard[]|null;
 instances:ReportInstanceCard[]|null;loading:boolean;error:string}){
 const defs:ResponsiveColumn<ReportDefinitionCard>[]=[
  {key:"name",heading:"Report",cell:r=>r.name},
  {key:"kind",heading:"Category",cell:r=>r.kind},
  {key:"status",heading:"Status",cell:r=>r.active===null?"Unverified":r.active?"Active":"Inactive"},
  {key:"schedule",heading:"Frequency",cell:r=>r.frequency},
 ];
 const history:ResponsiveColumn<ReportInstanceCard>[]=[
  {key:"title",heading:"Generated report",cell:r=>r.title},
  {key:"status",heading:"Status",cell:r=>r.status},
  {key:"format",heading:"Format",cell:r=>r.format},
  {key:"date",heading:"Generated",cell:r=>r.generatedAt?new Date(r.generatedAt).toLocaleDateString("en-GB"):"Not recorded"},
 ];
 return <div className="space-y-5">
  {loading?<p role="status" className="text-sm text-console-muted">Loading report records…</p>:null}
  {error?<Explanation warning title="Report library unavailable" body={error}/>:null}
  {!loading&&definitions?<Panel><h2 className="mb-4 text-sm font-medium">Report definitions</h2>
   <ResponsiveTable caption="Registered report definitions" rows={definitions} columns={defs}
    getRowKey={r=>r.id} emptyDescription="No definitions have been published."/></Panel>:null}
  {!loading&&instances?<Panel><h2 className="mb-4 text-sm font-medium">Generated report history</h2>
   <ResponsiveTable caption="Previously generated report records" rows={instances} columns={history}
    getRowKey={r=>r.id} emptyDescription="No historical reports have been recorded."/></Panel>:null}
  <Explanation warning title="Secure report downloads"
   body="Downloading or generating report files remains unavailable until private storage, object-level permissions, audit receipts and expiry-limited downloads have been qualified. No public media URLs are exposed."/>
 </div>;
}
