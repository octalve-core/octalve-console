"use client";
import type {LucideIcon} from "lucide-react";

import {navigationIcons} from "@/features/shell/lib/navigation-icons";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {WorkspaceMetricTile,type MetricTone} from "@/components/data/WorkspaceMetricTile";
import {formatCurrency} from "@/lib/formatters";
import {useLocale} from "@/lib/i18n/LocaleProvider";
import {translateNavigationLabel} from "@/lib/i18n/dictionary";
import type {ClientSummary} from "../hooks/useClientSummary";
type Metric={label:string;value:string;description:string;icon:LucideIcon;tone:MetricTone;href:string};
export function ClientOverviewMetrics({summary,balanceVisible}:{summary:ClientSummary;balanceVisible:boolean}){
 const {locale}=useLocale(),waiting=summary.status==="loading";

 const count=(value:number|null)=>waiting?"…":value===null?"—":
  new Intl.NumberFormat(locale==="fr"?"fr-FR":"en-NG",{maximumFractionDigits:0}).format(value);
 const balance=waiting?"…":summary.wallet===null?"—":balanceVisible?formatCurrency(summary.wallet):"••••••";
 const metrics:Metric[]=[
  {label:"Services",value:count(summary.services),description:"Your hosting and cloud services",icon:navigationIcons.packageCheck,href:"/client/services",tone:"blue"},
  {label:"Unpaid invoices",value:count(summary.invoices),description:"Invoices awaiting payment",icon:navigationIcons.receiptText,href:"/client/invoices",tone:"amber"},
  {label:"Domains",value:count(summary.domains),description:"Your domain names",icon:navigationIcons.globe2,href:"/client/domains",tone:"violet"},
  {label:"Wallet balance",value:balance,description:summary.wallet===null&&!waiting?"Balance temporarily unavailable":"Available account credit",icon:navigationIcons.walletCards,href:"/client/wallet",tone:"green"},
  {label:"Support tickets",value:count(summary.tickets),description:"Your support requests",icon:navigationIcons.lifeBuoy,href:"/client/support",tone:"rose"}
 ];
 return <section aria-labelledby="account-overview-heading">
  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
   <h2 id="account-overview-heading" className="text-console-section font-medium">Account overview</h2>
   <p className="text-xs text-console-muted xl:hidden">Scroll to explore</p>
  </div>
  <WorkspaceGrid variant="clientMetrics" ariaLabel={translateNavigationLabel("Your account summary",locale)} busy={waiting}>
  {metrics.map(item=><WorkspaceMetricTile key={item.label}
   label={translateNavigationLabel(item.label,locale)} description={translateNavigationLabel(item.description,locale)}
   icon={item.icon} tone={item.tone} value={item.value} href={item.href}
   tinted/>)}
 </WorkspaceGrid></section>;
}
