import {CreditCard,Globe2,PackageCheck,ReceiptText,Server,Users,type LucideIcon} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {formatNumber} from "@/lib/formatters";
export type AdminOverviewCounts={customers:number|null;services:number|null;invoices:number|null;domains:number|null;providers:number|null;transactions:number|null};
type Key=keyof AdminOverviewCounts;
const items:readonly {key:Key;label:string;description:string;icon:LucideIcon;accent:string}[]=[
 {key:"customers",label:"Customers",description:"Registered customer accounts",icon:Users,accent:"bg-blue-50 text-console-primary"},
 {key:"services",label:"Services",description:"Hosting and cloud services",icon:PackageCheck,accent:"bg-emerald-50 text-emerald-800"},
 {key:"invoices",label:"Invoices",description:"Issued billing records",icon:ReceiptText,accent:"bg-amber-50 text-amber-800"},
 {key:"domains",label:"Domains",description:"Domain records",icon:Globe2,accent:"bg-violet-50 text-violet-800"},
 {key:"providers",label:"Providers",description:"Provider connection records",icon:Server,accent:"bg-rose-50 text-rose-800"},
 {key:"transactions",label:"Transactions",description:"Payment transaction records",icon:CreditCard,accent:"bg-blue-50 text-blue-800"}
];
export function AdminOverviewMetrics({counts,loading}:{counts:AdminOverviewCounts;loading:boolean}){
 return <section aria-label="Admin account summary" aria-busy={loading}
  className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
  {items.map(item=>{const Icon=item.icon,value=counts[item.key];return <Panel key={item.key}
   className="flex min-h-36 flex-col justify-between">
   <div className="flex min-w-0 items-start justify-between gap-2">
    <div className="min-w-0"><h2 className="text-sm font-medium text-console-muted">{item.label}</h2>
     <p className="mt-3 break-words text-2xl font-bold text-console-ink">{loading?"…":value===null?"—":formatNumber(value)}</p>
    </div>
    <span aria-hidden="true" className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-xl "+item.accent}>
     <Icon className="h-5 w-5"/>
    </span>
   </div>
   <p className="mt-4 text-xs leading-5 text-console-muted">{item.description}</p>
  </Panel>;})}
 </section>;
}
