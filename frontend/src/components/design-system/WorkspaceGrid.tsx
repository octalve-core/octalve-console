import type {ReactNode} from "react";
import {cn} from "@/lib/utils";
export type WorkspaceGridVariant="filters"|"adminMetrics"|"staffMetrics"|"clientMetrics"|
 "quickActions"|"overviewPair"|"directory"|"responsive2"|"responsive3"|"responsive4"|
 "commerceColumns"|"supportColumns"|"domainFacts"|"domainPanels"|
 "choiceColumns"|"planCards"|"editorFields";
type Props={variant:WorkspaceGridVariant;children:ReactNode;className?:string;
 ariaLabel?:string;busy?:boolean;as?:"div"|"ul"|"dl"|"section"};
/** Static Tailwind v3 class definitions: one source for every role's responsive grid. */
const variants:Record<WorkspaceGridVariant,string>={
 filters:"grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2",
 adminMetrics:"grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6",
 staffMetrics:"grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5",
 clientMetrics:"grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5",
 quickActions:"grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4",
 overviewPair:"grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2",
 directory:"grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3",
 responsive2:"grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2",
 responsive3:"grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3",
 responsive4:"grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
 commerceColumns:"grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-3",
 supportColumns:"grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-3",
 domainFacts:"grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
 domainPanels:"grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2",
 choiceColumns:"grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3",
 planCards:"grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3",
 editorFields:"grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2",
};
export function WorkspaceGrid({variant,children,className,ariaLabel,busy,as="div"}:Props){
 const css=cn(variants[variant],className);
 if(as==="ul")return <ul className={css} aria-label={ariaLabel} aria-busy={busy}>{children}</ul>;
 if(as==="dl")return <dl className={css} aria-label={ariaLabel}>{children}</dl>;
 if(as==="section")return <section className={css} aria-label={ariaLabel}>{children}</section>;
 if(!["adminMetrics","staffMetrics","clientMetrics"].includes(variant))
  return <div className={css}>{children}</div>;
 return <section className={css} aria-label={ariaLabel} aria-busy={busy}>{children}</section>;
}
