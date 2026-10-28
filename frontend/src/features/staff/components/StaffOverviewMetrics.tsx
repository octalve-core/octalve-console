import {BookOpen,LifeBuoy,ShoppingCart,Users,Zap,type LucideIcon} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {WorkspaceGrid} from "@/components/design-system/WorkspaceGrid";
import {ConsoleIconTile} from "@/components/design-system/ConsoleIconTile";
import {formatNumber} from "@/lib/formatters";
import type {StaffResourceKey} from "../data/staff-demo-data";
export type StaffSummaryCounts=Record<StaffResourceKey,number|null>;
type Metric={key:StaffResourceKey;label:string;description:string;icon:LucideIcon;tone:"blue"|"green"|"amber"|"violet"|"rose"};
const metrics:readonly Metric[]=[
 {key:"customers",label:"Assigned customers",description:"Accounts available to your role",icon:Users,tone:"blue"},
 {key:"orders",label:"Orders",description:"Orders visible to your team",icon:ShoppingCart,tone:"amber"},
 {key:"provisioning",label:"Provisioning tasks",description:"Tasks in the permitted queue",icon:Zap,tone:"violet"},
 {key:"tickets",label:"Tickets",description:"Support requests",icon:LifeBuoy,tone:"rose"},
 {key:"knowledgeBase",label:"Knowledge articles",description:"Available support guides",icon:BookOpen,tone:"green"}
];
export function StaffOverviewMetrics({counts,loading}:{
 counts:StaffSummaryCounts;loading:boolean;
}){
 return <WorkspaceGrid variant="staffMetrics" ariaLabel="Staff account summary" busy={loading}>
  {metrics.map(item=>{
   const value=counts[item.key];
   return <Panel key={item.key} className="flex min-h-36 flex-col justify-between">
    <div className="flex min-w-0 items-start justify-between gap-3">
     <div className="min-w-0">
      <h2 className="text-sm font-medium text-console-muted">{item.label}</h2>
      <p className="mt-3 break-words text-2xl font-bold text-console-ink" aria-label={item.label+" count"}>
       {loading?"…":value===null?"—":formatNumber(value)}
      </p>
     </div>
     <ConsoleIconTile icon={item.icon} tone={item.tone}/>
    </div>
    <p className="mt-4 text-xs leading-5 text-console-muted">{item.description}</p>
   </Panel>;
  })}
 </WorkspaceGrid>;
}
