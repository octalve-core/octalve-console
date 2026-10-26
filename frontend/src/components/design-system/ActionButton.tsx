"use client";
import {LoaderCircle} from "lucide-react";
import type {ButtonHTMLAttributes,ReactNode} from "react";
import {cn} from "@/lib/utils";

export type ActionVariant="primary"|"secondary"|"outline"|"ghost"|"danger";
export type ActionSize="sm"|"md"|"lg";
export const actionBase="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
export const actionVariants:Record<ActionVariant,string>={
 primary:"bg-console-primary text-white hover:bg-console-hover",
 secondary:"bg-console-sidebar text-white hover:bg-slate-800",
 outline:"border border-slate-300 bg-white text-console-ink hover:bg-slate-50",
 ghost:"bg-transparent text-console-ink hover:bg-slate-100",
 danger:"bg-rose-600 text-white hover:bg-rose-700"
};
export const actionSizes:Record<ActionSize,string>={
 sm:"h-10 px-3 text-sm",md:"h-12 px-5 text-sm",lg:"h-14 px-6 text-base"
};
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
