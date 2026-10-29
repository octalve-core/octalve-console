import type {ReactNode} from "react";
export function PageHeader({title,description,eyebrow="Octalve Console",actions}:{
 title:string;description?:string;eyebrow?:string;actions?:ReactNode;
}){
 return <header className="mb-4 flex min-w-0 flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
  <div className="min-w-0">
   <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-console-primary">{eyebrow}</p>
   <h1 className="mt-1 break-words text-xl font-medium tracking-tight text-console-ink sm:text-2xl">{title}</h1>
   {description?<p className="mt-1 max-w-3xl text-[13px] leading-5 text-console-muted">{description}</p>:null}
  </div>
  {actions?<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>:null}
 </header>;
}
