import type {ReactNode} from "react";
import {cn} from "@/lib/utils";
import styles from "./WorkspaceGrid.module.css";

export type WorkspaceGridVariant="filters"|"adminMetrics"|"staffMetrics"|"clientMetrics"|"quickActions";
type Props={
 variant:WorkspaceGridVariant;children:ReactNode;className?:string;
 ariaLabel?:string;busy?:boolean;
};
/** Use only for approved Admin/Staff groupings; layout, no API or role authority. */
export function WorkspaceGrid({variant,children,className,ariaLabel,busy}:Props){
 const css=cn(styles[variant],className);
 if(variant==="filters"||variant==="quickActions")return <div className={css}>{children}</div>;
 return <section className={css} aria-label={ariaLabel} aria-busy={busy}>{children}</section>;
}
