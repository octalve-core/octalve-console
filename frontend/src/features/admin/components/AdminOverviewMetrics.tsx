import {CreditCard,Globe2,PackageCheck,ReceiptText,Server,Users,type LucideIcon} from "lucide-react";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {WorkspaceMetricTile,type MetricTone} from "@/components/data/WorkspaceMetricTile";
import {formatNumber} from "@/lib/formatters";
export type AdminOverviewCounts={customers:number|null;services:number|null;invoices:number|null;domains:number|null;providers:number|null;transactions:number|null};
type Key=keyof AdminOverviewCounts;
const items:readonly {key:Key;label:string;description:string;icon:LucideIcon;tone:MetricTone}[]=[
 {key:"customers",label:"Customers",description:"Registered customer accounts",icon:Users,tone:"blue"},
 {key:"services",label:"Services",description:"Hosting and cloud services",icon:PackageCheck,tone:"green"},
 {key:"invoices",label:"Invoices",description:"Issued billing records",icon:ReceiptText,tone:"amber"},
 {key:"domains",label:"Domains",description:"Domain records",icon:Globe2,tone:"violet"},
 {key:"providers",label:"Providers",description:"Provider connection records",icon:Server,tone:"rose"},
 {key:"transactions",label:"Transactions",description:"Payment transaction records",icon:CreditCard,tone:"blue"}
];
export function AdminOverviewMetrics({counts,loading}:{counts:AdminOverviewCounts;loading:boolean}){
 return <WorkspaceGrid variant="adminMetrics" ariaLabel="Admin account summary" busy={loading}>
  {items.map(item=><WorkspaceMetricTile key={item.key} label={item.label} description={item.description}
   icon={item.icon} tone={item.tone} value={loading?"…":counts[item.key]===null?"—":formatNumber(counts[item.key]!)}/>)}
 </WorkspaceGrid>;
}
