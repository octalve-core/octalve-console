import type {LucideIcon} from "lucide-react";
import {ArrowDownRight,ArrowUpRight,Minus} from "lucide-react";
import {Panel} from "./Panel";
import {ConsoleIconTile} from "./ConsoleIconTile";

export type MetricKpiTrend={percent:string;direction:"up"|"down"|"flat";context:string};
type Tone="blue"|"green"|"amber"|"violet"|"rose"|"slate";
/** Reusable KPI with trend evidence. Never infer a direction without comparison data. */
export function MetricKpiCard({title,value,note,icon,tone="blue",trend}:{
 title:string;value:string;note:string;icon:LucideIcon;tone?:Tone;trend?:MetricKpiTrend;
}){
 const Glyph=trend?.direction==="up"?ArrowUpRight:trend?.direction==="down"?ArrowDownRight:Minus;
 return <Panel className="flex min-h-36 flex-col justify-between gap-3 shadow-[0_5px_18px_rgba(17,37,65,0.04)]">
  <div className="flex items-start justify-between gap-3">
   <div className="min-w-0"><h2 className="text-xs font-medium text-console-muted">{title}</h2>
    <p className="mt-3 break-words text-xl font-medium tracking-tight tabular-nums text-console-ink sm:text-2xl">{value}</p>
   </div><ConsoleIconTile icon={icon} tone={tone}/>
  </div>
  <div className="flex flex-wrap items-center gap-2">
   {trend?<span aria-label={trend.context+": "+trend.percent} className={
    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium "+
    (trend.direction==="up"?"bg-emerald-50 text-emerald-700":
     trend.direction==="down"?"bg-rose-50 text-rose-700":"bg-slate-100 text-slate-700")
   }><Glyph aria-hidden="true" className="h-3.5 w-3.5"/>{trend.percent}</span>:null}
   <p className="text-xs leading-5 text-console-muted">{note}</p>
  </div>
 </Panel>;
}
/** No invented zero-growth when there is no previous-period baseline. */
export function metricTrend(current:number,previous:number,context="Month to date versus previous calendar month"):MetricKpiTrend|undefined{
 if(!Number.isFinite(current)||!Number.isFinite(previous)||previous<=0)return undefined;
 const percent=(current-previous)/previous*100;
 return {percent:Math.abs(percent).toFixed(1)+"%",direction:percent>0?"up":percent<0?"down":"flat",context};
}
