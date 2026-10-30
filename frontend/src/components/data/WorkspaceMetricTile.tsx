import type {LucideIcon} from "lucide-react";
import type {ReactNode} from "react";
import {Panel} from "@/components/design-system/Panel";
import {ConsoleIconTile} from "@/components/design-system/ConsoleIconTile";
export type MetricTone="blue"|"green"|"amber"|"violet"|"rose";
/** Canonical soft-shadow KPI tile. The caller owns server-confirmed values and loading truth. */
export function WorkspaceMetricTile({label,value,description,icon,tone,action}:{label:string;value:string;
 description:string;icon:LucideIcon;tone:MetricTone;action?:ReactNode}){
 return <Panel className="flex min-h-[112px] flex-col justify-between shadow-[0_2px_12px_rgba(0,25,62,0.04)]">
  <div className="flex min-w-0 items-start justify-between gap-2">
   <div className="min-w-0">
    <h2 className="text-xs font-medium text-console-muted">{label}</h2>
    <p className="mt-1 break-words text-xl font-medium tracking-tight text-console-ink" aria-label={label+" value"}>{value}</p>
   </div>
   {action||<ConsoleIconTile icon={icon} tone={tone} size="md" className="rounded-xl"/>}
  </div>
  <p className="mt-2 text-xs leading-5 text-console-muted">{description}</p>
 </Panel>;
}
