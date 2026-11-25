import Link from "next/link";
import {ArrowUpRight,type LucideIcon} from "lucide-react";
import type {ReactNode} from "react";
import {Panel} from "@/components/design-system/Panel";
import {ConsoleIconTile} from "@/components/design-system/ConsoleIconTile";
export type MetricTone="blue"|"green"|"amber"|"violet"|"rose";

export function WorkspaceMetricTile({label,value,description,icon,tone,action,tinted=false,href}:{
 label:string;value:string;description:string;icon:LucideIcon;tone:MetricTone;
 action?:ReactNode;tinted?:boolean;href?:string;
}){
 const linked=!!href&&!action;
 const labelAndValue=<div className="min-w-0">
  <h2 className="text-sm font-medium">{label}</h2>
  <p className="mt-1 break-words text-xl font-medium tabular-nums tracking-tight" aria-label={label+" value"}>{value}</p>
 </div>;
 const iconTile=<ConsoleIconTile icon={icon} tone={tone} size="md"/>;
 const tile=<Panel tone={tinted?tone:undefined} elevation={tinted?"flat":"soft"}
  className={tinted?"flex h-full min-h-[158px] flex-col justify-between gap-2":"flex min-h-[124px] flex-col justify-between text-console-ink"}>
  {tinted
   ? <><div className="flex items-start justify-between gap-2">{action??iconTile}
     {linked&&<ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.9}/>}</div>{labelAndValue}</>
   : <div className="flex min-w-0 items-start justify-between gap-2">{labelAndValue}{action??iconTile}</div>}
  <p className="text-xs leading-5 text-slate-700">{description}</p>
 </Panel>;
 return linked?<Link href={href} className="block h-full min-w-0 rounded-2xl hover:brightness-[.98] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-console-primary">{tile}</Link>:tile;
}
