"use client";
import type {ButtonHTMLAttributes,ReactNode} from "react";
import {cn} from "@/lib/utils";
type IconActionButtonProps=Omit<ButtonHTMLAttributes<HTMLButtonElement>,"children">&{
 label:string;icon:ReactNode;size?:"sm"|"md";tone?:"neutral"|"primary"|"danger";
};
/** Icon buttons must be named, keyboard-focusable, and cannot submit forms by default. */
export function IconActionButton({label,icon,size="md",tone="neutral",className,type="button",...props}:IconActionButtonProps){
 const tones={
  neutral:"border-console-line bg-white text-console-muted hover:bg-slate-100 hover:text-console-ink",
  primary:"border-blue-200 bg-blue-50 text-console-primary hover:bg-blue-100",
  danger:"border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
 };
 return <button {...props} type={type} aria-label={label} title={label}
  className={cn("inline-flex shrink-0 items-center justify-center rounded-console-control border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
   size==="sm"?"h-10 w-10":"h-11 w-11",tones[tone],className)}>
  <span aria-hidden="true" className="inline-flex items-center justify-center">{icon}</span>
 </button>;
}
