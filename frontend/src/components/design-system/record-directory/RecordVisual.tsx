import {CircleUserRound} from "lucide-react";
import type {DirectoryRow} from "./types";
const styles={
 success:{chip:"bg-emerald-50 text-emerald-700",icon:"bg-emerald-100 text-emerald-700"},
 danger:{chip:"bg-rose-50 text-rose-700",icon:"bg-rose-100 text-rose-700"},
 warning:{chip:"bg-amber-50 text-amber-800",icon:"bg-amber-100 text-amber-700"},
 info:{chip:"bg-blue-50 text-console-primary",icon:"bg-blue-100 text-console-primary"},
 neutral:{chip:"bg-slate-100 text-slate-600",icon:"bg-slate-100 text-slate-600"}
} as const;
function tone(status:string):keyof typeof styles{
 const value=status.toLowerCase();
 if(["active","paid","completed","provisioned","available","resolved","accepted"].includes(value))return "success";
 if(["failed","cancelled","overdue","suspended","declined","refunded","locked"].includes(value))return "danger";
 if(["unpaid","pending","pending_payment","draft","processing"].includes(value))return "warning";
 if(["open","in_progress","waiting_staff"].includes(value))return "info";
 return "neutral";
}
export function DirectoryStatus({status}:{status:string}){
 return <span className={`inline-flex max-w-full items-center rounded-md px-2 py-1 text-[10px] font-medium sm:text-xs ${styles[tone(status)].chip}`}>
 {status.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase())}</span>;
}
export function DirectoryIcon({row}:{row:DirectoryRow}){
 return <span aria-hidden="true" className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${styles[tone(row.status)].icon}`}>
  {row.icon??<CircleUserRound className="h-5 w-5" strokeWidth={1.7}/>}
 </span>;
}
