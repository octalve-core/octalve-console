import type {LucideIcon} from "lucide-react";
import {cn} from "@/lib/utils";

type Tone="blue"|"green"|"amber"|"violet"|"rose"|"slate"|"cyan";
const tones:Record<Tone,string>={
 blue:"text-blue-700",
 green:"text-emerald-700",
 amber:"text-amber-700",
 violet:"text-violet-700",
 rose:"text-rose-700",
 slate:"text-slate-700",
 cyan:"text-cyan-800",
};
/** Shared Invoice-style Lucide treatment; no external icons or brand asset swap. */
export function ConsoleIconTile({icon:Icon,tone="blue",size="md",className}:{
 icon:LucideIcon;tone?:Tone;size?:"sm"|"md"|"lg";className?:string;
}){
 return <span aria-hidden="true" className={cn(
  "inline-flex shrink-0 items-center justify-center rounded-lg",
  size==="sm"?"h-9 w-9":size==="lg"?"h-12 w-12":"h-10 w-10",
  tones[tone],className
 )}><Icon className={size==="sm"?"h-4 w-4":"h-5 w-5"} strokeWidth={1.8}/></span>;
}
