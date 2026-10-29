import type {HTMLAttributes,ReactNode} from "react";
import {cn} from "@/lib/utils";
export type PanelProps=HTMLAttributes<HTMLElement>&{children:ReactNode;padded?:boolean};
export function Panel({children,padded=true,className,...props}:PanelProps){
 return <section {...props} className={cn("min-w-0 rounded-2xl border border-console-line bg-white shadow-sm",
  padded?"p-4":"",className)}>{children}</section>;
}
