import {BookOpen,LifeBuoy,ShoppingCart,Users,Zap,type LucideIcon} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {formatNumber} from "@/lib/formatters";
import type {StaffResourceKey} from "../data/staff-demo-data";
export type StaffSummaryCounts=Record<StaffResourceKey,number|null>;
type Metric={key:StaffResourceKey;label:string;description:string;icon:LucideIcon;accent:string};
const metrics:readonly Metric[]=[
 {key:"customers",label:"Assigned customers",description:"Accounts available to your role",icon:Users,accent:"bg-blue-50 text-console-primary"},
 {key:"orders",label:"Orders",description:"Orders visible to your team",icon:ShoppingCart,accent:"bg-amber-50 text-amber-800"},
 {key:"provisioning",label:"Provisioning tasks",description:"Tasks in the permitted queue",icon:Zap,accent:"bg-violet-50 text-violet-800"},
 {key:"tickets",label:"Tickets",description:"Support requests",icon:LifeBuoy,accent:"bg-rose-50 text-rose-800"},
 {key:"knowledgeBase",label:"Knowledge articles",description:"Available support guides",icon:BookOpen,accent:"bg-emerald-50 text-emerald-800"}
];
export function StaffOverviewMetrics({counts,loading}:{
 counts:StaffSummaryCounts;loading:boolean;
}){
 return <section aria-label="Staff account summary" aria-busy={loading}
  className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
  {metrics.map(item=>{
   const Icon=item.icon,value=counts[item.key];
   return <Panel key={item.key} className="flex min-h-36 flex-col justify-between">
    <div className="flex min-w-0 items-start justify-between gap-3">
     <div className="min-w-0">
      <h2 className="text-sm font-medium text-console-muted">{item.label}</h2>
      <p className="mt-3 break-words text-2xl font-bold text-console-ink" aria-label={item.label+" count"}>
       {loading?"…":value===null?"—":formatNumber(value)}
      </p>
     </div>
     <span aria-hidden="true" className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-xl "+item.accent}>
      <Icon className="h-5 w-5"/>
     </span>
    </div>
    <p className="mt-4 text-xs leading-5 text-console-muted">{item.description}</p>
   </Panel>;
  })}
 </section>;
}
