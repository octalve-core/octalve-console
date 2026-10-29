import {Check} from "lucide-react";
const steps=["Choose plan","Connect domain","Review order","Done"] as const;
export function CheckoutProgress({currentStep}:{currentStep:0|1|2|3}){
 return <ol aria-label="Checkout progress" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
  {steps.map((step,index)=><li key={step} aria-current={index===currentStep?"step":undefined}
   className={index<=currentStep?
    "min-w-0 rounded-xl border border-blue-200 bg-blue-50 p-3 text-center text-xs font-medium text-console-primary":
    "min-w-0 rounded-xl border border-console-line bg-white p-3 text-center text-xs font-medium text-console-muted"}>
   <span className="mb-1 flex min-h-4 justify-center">{index<currentStep?<Check aria-hidden="true" className="h-4 w-4"/>:String(index+1).padStart(2,"0")}</span>
   {step}
  </li>)}
 </ol>;
}
