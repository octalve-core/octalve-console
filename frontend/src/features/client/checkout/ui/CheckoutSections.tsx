import type {ReactNode} from "react";
import {CheckoutStepper,CheckoutColumns,CommercePanel} from "@/components/shared-commerce/CommerceUI";
export {CheckoutColumns};
export function CheckoutSteps({current}:{current:"Cart"|"Review order"|"Payment"}){return <div className="my-6"><CheckoutStepper stage={current==="Cart"?0:current==="Review order"?3:4}/></div>}
export function CheckoutSummary({title,children}:{title:string;children:ReactNode}){return <CommercePanel className="space-y-4"><h2 className="text-lg font-medium">{title}</h2>{children}</CommercePanel>}
