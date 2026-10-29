import type {ReactNode} from "react";
import {cn} from "@/lib/utils";
export function SectionHeading({title,description,eyebrow,actions,className}:{
 title:string;description?:string;eyebrow?:string;actions?:ReactNode;className?:string;
}){
 return <div className={cn("flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between",className)}>
  <div className="min-w-0">
   {eyebrow?<p className="text-[11px] font-medium uppercase tracking-widest text-console-primary">{eyebrow}</p>:null}
   <h2 className="mt-1 text-base font-medium tracking-tight text-console-ink sm:text-lg">{title}</h2>
   {description?<p className="mt-1 max-w-2xl text-[13px] leading-5 text-console-muted">{description}</p>:null}
  </div>{actions?<div className="flex flex-wrap items-center gap-2">{actions}</div>:null}
 </div>;
}
