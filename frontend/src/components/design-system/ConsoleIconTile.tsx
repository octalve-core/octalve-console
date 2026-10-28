import type {LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";

type Tone="blue"|"green"|"amber"|"violet"|"rose"|"slate";
const tones:Record<Tone,string>={
 blue:"bg-blue-50 text-console-primary",
 green:"bg-emerald-50 text-emerald-700",
 amber:"bg-amber-50 text-amber-700",
 violet:"bg-violet-50 text-violet-700",
 rose:"bg-rose-50 text-rose-700",
 slate:"bg-slate-100 text-slate-700",
};
/** Shared Invoice-style Lucide treatment; no external icons or brand asset swap. */
export function ConsoleIconTile({icon:Icon,tone="blue",size="md",className}:{
 icon:LucideIcon;tone?:Tone;size?:"sm"|"md"|"lg";className?:string;
}){
 return <span aria-hidden="true" className={cn(
  "inline-flex shrink-0 items-center justify-center rounded-xl",
  size==="sm"?"h-9 w-9":size==="lg"?"h-12 w-12":"h-11 w-11",
  tones[tone],className
 )}><Icon className={size==="sm"?"h-4 w-4":"h-5 w-5"} strokeWidth={1.9}/></span>;
}
