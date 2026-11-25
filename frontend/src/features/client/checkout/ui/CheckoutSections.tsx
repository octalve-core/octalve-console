import type {ReactNode} from "react";
import {Check} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {cn} from "@/lib/utils";

const steps=["Cart","Review order","Payment"] as const;
type CheckoutStep=(typeof steps)[number];

export function CheckoutSteps({current}:{current:CheckoutStep}){
  return <nav aria-label="Checkout progress" className="my-4">
    <ol className="grid grid-cols-3 gap-2">
      {steps.map((step,index)=>{
        const completed=index<steps.indexOf(current);
        return <li key={step} aria-current={step===current?"step":undefined}
          className={cn("flex min-w-0 items-center gap-2 rounded-xl bg-slate-100 px-2 py-2 text-xs font-medium text-console-muted sm:px-3 sm:text-sm",
            step===current&&"bg-blue-100 text-console-primary",completed&&"bg-emerald-50 text-emerald-800")}>
          <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-white">
            {completed?<Check size={14}/>:index+1}
          </span>
          {step}
        </li>;
      })}
    </ol>
  </nav>;
}

export function CheckoutColumns({children,summary}:{children:ReactNode;summary:ReactNode}){
  return <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
    <div className="min-w-0 space-y-4">{children}</div>
    <div className="min-w-0 lg:sticky lg:top-24">{summary}</div>
  </div>;
}

export function CheckoutSummary({title,children}:{title:string;children:ReactNode}){
  return <Panel className="space-y-4">
    <h2 className="text-lg font-medium text-console-ink">{title}</h2>
    {children}
  </Panel>;
}
