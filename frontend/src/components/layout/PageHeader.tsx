import type {ReactNode} from "react";
export function PageHeader({title,description,eyebrow="Octalve Console",actions}:{
 title:string;description?:string;eyebrow?:string;actions?:ReactNode;
}){
 return <header className="mb-7 flex min-w-0 flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
  <div className="min-w-0">
   <p className="text-xs font-medium uppercase tracking-wider text-console-primary">{eyebrow}</p>
   <h1 className="mt-2 break-words text-2xl font-medium tracking-tight text-console-ink sm:text-3xl">{title}</h1>
   {description?<p className="mt-2 max-w-3xl text-sm leading-6 text-console-muted">{description}</p>:null}
  </div>
  {actions?<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>:null}
 </header>;
}
