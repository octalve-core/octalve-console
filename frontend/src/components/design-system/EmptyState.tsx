import {Inbox,type LucideIcon} from "lucide-react";
import type {ReactNode} from "react";
export function EmptyState({title,description,icon:Icon=Inbox,action}:{
 title:string;description?:string;icon?:LucideIcon;action?:ReactNode;
}){
 return <div className="flex min-w-0 flex-col items-center rounded-2xl border border-dashed border-console-line bg-white px-5 py-10 text-center">
  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-console-primary">
   <Icon aria-hidden="true" className="h-6 w-6"/>
  </div>
  <h3 className="mt-4 text-base font-semibold text-console-ink">{title}</h3>
  {description?<p className="mt-2 max-w-md text-sm leading-6 text-console-muted">{description}</p>:null}
  {action?<div className="mt-5">{action}</div>:null}
 </div>;
}
