import type {ReactNode} from "react";
import {Check, ChevronDown} from "lucide-react";
import {cn} from "@/lib/utils";

export function PublishedPackageCard({name,description,price,period,features,selected,action,badge}:{
  name:string; description?:string; price:string; period?:string; features:readonly string[];
  selected?:boolean; action:ReactNode; badge?:ReactNode;
}){
  const visible=features.slice(0,4);
  const more=features.slice(4);
  const feature=(value:string,index:number)=><li key={index} className="flex min-w-0 items-start gap-2 text-sm text-console-ink">
    <Check size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-console-primary"/>
    <span className="min-w-0 break-words">{value}</span>
  </li>;

  return <article className={cn("flex min-w-0 flex-col rounded-2xl bg-slate-100 p-2",selected&&"ring-2 ring-console-primary")}>
    <div className="flex flex-1 flex-col rounded-xl bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="min-w-0 break-words text-lg font-medium text-console-ink">{name}</h2>
        {badge}
      </div>
      {description&&<p className="mt-2 line-clamp-2 break-words text-sm text-console-muted" title={description}>{description}</p>}
      <p className="mt-auto break-words pt-4 text-2xl font-medium tabular-nums text-console-ink">{price}</p>
      {period&&<p className="mt-1 text-xs text-console-muted">{period}</p>}
      <div className="mt-4">{action}</div>
    </div>
    {visible.length>0&&<div className="space-y-3 p-4">
      <ul className="space-y-2">{visible.map(feature)}</ul>
      {more.length>0&&<details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-sm font-medium text-console-primary focus-visible:ring-2 focus-visible:ring-console-primary">
          See more features <ChevronDown size={16} aria-hidden="true" className="group-open:rotate-180"/>
        </summary>
        <ul className="mt-2 space-y-2">{more.map(feature)}</ul>
      </details>}
    </div>}
  </article>;
}
