import type {ReactNode} from "react";
import {cn} from "@/lib/utils";
import styles from "./WorkspaceGrid.module.css";

export type WorkspaceGridVariant="filters"|"adminMetrics"|"staffMetrics"|"clientMetrics"|"quickActions"|"overviewPair"|"directory"|"responsive2"|"responsive3"|"responsive4";
type Props={
 variant:WorkspaceGridVariant;children:ReactNode;className?:string;
 ariaLabel?:string;busy?:boolean;
};
/** Responsive shared layout for all Console roles; owns no API, mutation or authentication authority. */
export function WorkspaceGrid({variant,children,className,ariaLabel,busy}:Props){
 const css=cn(styles[variant],className);
 if(!["adminMetrics","staffMetrics","clientMetrics"].includes(variant))return <div className={css}>{children}</div>;
 return <section className={css} aria-label={ariaLabel} aria-busy={busy}>{children}</section>;
}
