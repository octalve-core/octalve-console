"use client";
import {LoaderCircle} from "lucide-react";
import type {ButtonHTMLAttributes,ReactNode} from "react";
import {cn} from "@/lib/utils";

import {actionBase,actionSizes,actionVariants,type ActionSize,type ActionVariant} from "./action-styles";
export type ActionButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&{
 children:ReactNode;variant?:ActionVariant;size?:ActionSize;loading?:boolean;
 leadingIcon?:ReactNode;trailingIcon?:ReactNode;
};
export function ActionButton({children,variant="primary",size="md",loading=false,
 leadingIcon,trailingIcon,disabled,type="button",className,...props}:ActionButtonProps){
 return <button {...props} type={type} disabled={disabled||loading} aria-busy={loading||undefined}
  className={cn(actionBase,actionVariants[variant],actionSizes[size],className)}>
   {loading?<LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin"/>:leadingIcon}
   <span>{children}</span>{!loading&&trailingIcon}
 </button>;
}
