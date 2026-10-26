import {CreditCard,Globe2,PackageCheck,Ticket,WalletCards,type LucideIcon} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {formatCurrency,formatNumber} from "@/lib/formatters";
import type {ClientSummary} from "../hooks/useClientSummary";

type Metric={label:string;value:string;description:string;icon:LucideIcon;iconStyle:string};
export function ClientOverviewMetrics({summary}: {summary:ClientSummary}){
 const waiting=summary.status==="loading";
 const count=(value:number|null)=>waiting?"…":value===null?"—":formatNumber(value);
 const balance=waiting?"…":summary.wallet===null?"—":formatCurrency(summary.wallet);
 const metrics:Metric[]=[
  {label:"Services",value:count(summary.services),description:"Your hosting and cloud services",icon:PackageCheck,iconStyle:"bg-blue-50 text-console-primary"},
  {label:"Unpaid invoices",value:count(summary.invoices),description:"Invoices awaiting payment",icon:CreditCard,iconStyle:"bg-amber-50 text-amber-700"},
  {label:"Domains",value:count(summary.domains),description:"Your domain names",icon:Globe2,iconStyle:"bg-violet-50 text-violet-700"},
  {label:"Wallet balance",value:balance,description:summary.wallet===null&&!waiting?"Balance temporarily unavailable":"Available account credit",icon:WalletCards,iconStyle:"bg-emerald-50 text-emerald-700"},
  {label:"Support tickets",value:count(summary.tickets),description:"Your support requests",icon:Ticket,iconStyle:"bg-rose-50 text-rose-700"}
 ];
 return <section aria-label="Your account summary" aria-busy={waiting} className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
  {metrics.map(metric=>{const Icon=metric.icon;return <Panel key={metric.label} className="flex min-h-36 flex-col justify-between">
   <div className="flex items-start justify-between gap-3">
    <div className="min-w-0"><p className="text-sm font-medium text-console-muted">{metric.label}</p>
     <p className="mt-2 break-words text-2xl font-bold tracking-tight text-console-ink sm:text-[27px]">{metric.value}</p>
    </div>
    <span aria-hidden="true" className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-xl "+metric.iconStyle}><Icon className="h-5 w-5"/></span>
   </div>
   <p className="mt-3 text-xs leading-5 text-console-muted">{metric.description}</p>
  </Panel>;})}
 </section>;
}
