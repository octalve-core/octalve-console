import type {ReactNode} from "react";
import {cn} from "@/lib/utils";
import styles from "./WorkspaceGrid.module.css";

export type WorkspaceGridVariant="filters"|"adminMetrics"|"staffMetrics"|"clientMetrics"|"quickActions"|"overviewPair"|"directory"|"responsive2"|"responsive3"|"responsive4"|"commerceColumns"|"supportColumns"|"domainFacts"|"domainPanels"|"choiceColumns"|"planCards"|"editorFields";
type Props={
 variant:WorkspaceGridVariant;children:ReactNode;className?:string;
 ariaLabel?:string;busy?:boolean;as?:"div"|"ul"|"dl"|"section";
};
/** Responsive shared layout for all Console roles; owns no API, mutation or authentication authority. */
export function WorkspaceGrid({variant,children,className,ariaLabel,busy,as="div"}:Props){
 const css=cn(styles[variant],className);
 if(as==="ul")return <ul className={css} aria-label={ariaLabel} aria-busy={busy}>{children}</ul>;
 if(as==="dl")return <dl className={css} aria-label={ariaLabel}>{children}</dl>;
 if(as==="section")return <section className={css} aria-label={ariaLabel}>{children}</section>;
 if(!["adminMetrics","staffMetrics","clientMetrics"].includes(variant))return <div className={css}>{children}</div>;
 return <section className={css} aria-label={ariaLabel} aria-busy={busy}>{children}</section>;
}
