import type {HTMLAttributes,ReactNode} from "react";
import {cn} from "@/lib/utils";
import {semanticSurfaces,type SemanticTone} from "./semantic-surfaces";
export type PanelProps=HTMLAttributes<HTMLElement>&{children:ReactNode;padded?:boolean;tone?:SemanticTone};
export function Panel({children,padded=true,tone,className,...props}:PanelProps){
 return <section {...props} className={cn("min-w-0 rounded-2xl border shadow-console-surface",tone?semanticSurfaces[tone]:"border-console-line bg-white",
  padded?"p-[var(--console-panel-padding,1rem)]":"",className)}>{children}</section>;
}
