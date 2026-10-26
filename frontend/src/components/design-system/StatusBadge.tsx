import type {HTMLAttributes,ReactNode} from "react";
import {cn} from "@/lib/utils";
export type StatusTone="neutral"|"success"|"warning"|"error"|"info";
const tones:Record<StatusTone,string>={
 neutral:"bg-slate-100 text-slate-700",
 success:"bg-emerald-50 text-emerald-800",
 warning:"bg-amber-50 text-amber-900",
 error:"bg-rose-50 text-rose-800",
 info:"bg-blue-50 text-blue-800"
};
export function StatusBadge({tone="neutral",children,className,...props}:
 HTMLAttributes<HTMLSpanElement>&{tone?:StatusTone;children:ReactNode}){
 return <span {...props} className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
  tones[tone],className)}>{children}</span>;
}
