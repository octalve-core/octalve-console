import {CreditCard,Globe2,PackageCheck,ReceiptText,Server,Users,type LucideIcon} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {ConsoleIconTile} from "@/components/design-system/ConsoleIconTile";
import {formatNumber} from "@/lib/formatters";
export type AdminOverviewCounts={customers:number|null;services:number|null;invoices:number|null;domains:number|null;providers:number|null;transactions:number|null};
type Key=keyof AdminOverviewCounts;
const items:readonly {key:Key;label:string;description:string;icon:LucideIcon;tone:"blue"|"green"|"amber"|"violet"|"rose"}[]=[
 {key:"customers",label:"Customers",description:"Registered customer accounts",icon:Users,tone:"blue"},
 {key:"services",label:"Services",description:"Hosting and cloud services",icon:PackageCheck,tone:"green"},
 {key:"invoices",label:"Invoices",description:"Issued billing records",icon:ReceiptText,tone:"amber"},
 {key:"domains",label:"Domains",description:"Domain records",icon:Globe2,tone:"violet"},
 {key:"providers",label:"Providers",description:"Provider connection records",icon:Server,tone:"rose"},
 {key:"transactions",label:"Transactions",description:"Payment transaction records",icon:CreditCard,tone:"blue"}
];
export function AdminOverviewMetrics({counts,loading}:{counts:AdminOverviewCounts;loading:boolean}){
 return <WorkspaceGrid variant="adminMetrics" ariaLabel="Admin account summary" busy={loading}>
  {items.map(item=>{const value=counts[item.key];return <Panel key={item.key}
   className="flex min-h-[108px] flex-col justify-between">
   <div className="flex min-w-0 items-start justify-between gap-2">
    <div className="min-w-0"><h2 className="text-xs font-medium text-console-muted">{item.label}</h2>
     <p className="mt-1 break-words text-xl font-medium text-console-ink">{loading?"…":value===null?"—":formatNumber(value)}</p>
    </div>
    <ConsoleIconTile icon={item.icon} tone={item.tone} size="sm"/>
   </div>
   <p className="mt-2 text-xs leading-5 text-console-muted">{item.description}</p>
  </Panel>;})}
 </WorkspaceGrid>;
}
