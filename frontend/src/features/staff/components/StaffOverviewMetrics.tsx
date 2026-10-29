import {BookOpen,LifeBuoy,ShoppingCart,Users,Zap,type LucideIcon} from "lucide-react";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {WorkspaceMetricTile,type MetricTone} from "@/components/data/WorkspaceMetricTile";
import {formatNumber} from "@/lib/formatters";
import type {StaffResourceKey} from "../data/staff-demo-data";
export type StaffSummaryCounts=Record<StaffResourceKey,number|null>;
const metrics:readonly {key:StaffResourceKey;label:string;description:string;icon:LucideIcon;tone:MetricTone}[]=[
 {key:"customers",label:"Assigned customers",description:"Accounts available to your role",icon:Users,tone:"blue"},
 {key:"orders",label:"Orders",description:"Orders visible to your team",icon:ShoppingCart,tone:"amber"},
 {key:"provisioning",label:"Provisioning tasks",description:"Tasks in the permitted queue",icon:Zap,tone:"violet"},
 {key:"tickets",label:"Tickets",description:"Support requests",icon:LifeBuoy,tone:"rose"},
 {key:"knowledgeBase",label:"Knowledge articles",description:"Available support guides",icon:BookOpen,tone:"green"}
];
export function StaffOverviewMetrics({counts,loading}:{counts:StaffSummaryCounts;loading:boolean}){
 return <WorkspaceGrid variant="staffMetrics" ariaLabel="Staff account summary" busy={loading}>
  {metrics.map(item=><WorkspaceMetricTile key={item.key} label={item.label} description={item.description}
   icon={item.icon} tone={item.tone} value={loading?"…":counts[item.key]===null?"—":formatNumber(counts[item.key]!)}/>)}
 </WorkspaceGrid>;
}
