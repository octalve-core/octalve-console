import Link from "next/link";
import type {ReactNode} from "react";
import {cn} from "@/lib/utils";
import {actionBase,actionSizes,actionVariants,type ActionSize,type ActionVariant} from "./action-styles";
export type ActionLinkProps={
 href:string;children:ReactNode;variant?:ActionVariant;size?:ActionSize;
 className?:string;external?:boolean;ariaLabel?:string;
};
export function ActionLink({href,children,variant="primary",size="md",className,
 external=false,ariaLabel}:ActionLinkProps){
 return <Link href={href} aria-label={ariaLabel} target={external?"_blank":undefined}
  rel={external?"noopener noreferrer":undefined}
  className={cn(actionBase,actionSizes[size],actionVariants[variant],className)}>
   {children}
 </Link>;
}
