"use client";
import {CreditCard,Globe2,PackageCheck,Ticket,WalletCards,Eye,EyeOff,type LucideIcon} from "lucide-react";
import {useState} from "react";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {WorkspaceMetricTile,type MetricTone} from "@/components/data/WorkspaceMetricTile";
import {formatCurrency} from "@/lib/formatters";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {translateNavigationLabel} from "@/lib/i18n/dictionary";
import type {ClientSummary} from "../hooks/useClientSummary";
type Metric={label:string;value:string;description:string;icon:LucideIcon;tone:MetricTone};
export function ClientOverviewMetrics({summary}:{summary:ClientSummary}){
 const {locale}=useLocale(),waiting=summary.status==="loading";
 const [balanceVisible,setBalanceVisible]=useState(false);
 const count=(value:number|null)=>waiting?"…":value===null?"—":
  new Intl.NumberFormat(locale==="fr"?"fr-FR":"en-NG",{maximumFractionDigits:0}).format(value);
 const balance=waiting?"…":summary.wallet===null?"—":balanceVisible?formatCurrency(summary.wallet):"••••••";
 const metrics:Metric[]=[
  {label:"Services",value:count(summary.services),description:"Your hosting and cloud services",icon:PackageCheck,tone:"blue"},
  {label:"Unpaid invoices",value:count(summary.invoices),description:"Invoices awaiting payment",icon:CreditCard,tone:"amber"},
  {label:"Domains",value:count(summary.domains),description:"Your domain names",icon:Globe2,tone:"violet"},
  {label:"Wallet balance",value:balance,description:summary.wallet===null&&!waiting?"Balance temporarily unavailable":"Available account credit",icon:WalletCards,tone:"green"},
  {label:"Support tickets",value:count(summary.tickets),description:"Your support requests",icon:Ticket,tone:"rose"}
 ];
 return <WorkspaceGrid variant="clientMetrics" ariaLabel={translateNavigationLabel("Your account summary",locale)} busy={waiting}>
  {metrics.map(item=><WorkspaceMetricTile key={item.label}
   label={translateNavigationLabel(item.label,locale)} description={translateNavigationLabel(item.description,locale)}
   icon={item.icon} tone={item.tone} value={item.value}
   action={item.label==="Wallet balance"?<button type="button" aria-label={balanceVisible?"Hide wallet balance":"Show wallet balance"}
     aria-pressed={balanceVisible} onClick={()=>setBalanceVisible(v=>!v)}
     className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-console-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-primary">
     {balanceVisible?<EyeOff aria-hidden="true" className="h-5 w-5"/>:<Eye aria-hidden="true" className="h-5 w-5"/>}
    </button>:undefined}/>)}
 </WorkspaceGrid>;
}
