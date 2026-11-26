import {CheckoutStepper} from "@/components/shared-commerce/CommerceUI";
export function CheckoutProgress({currentStep}:{currentStep:0|1|2|3}){return <div className="mb-6"><CheckoutStepper stage={[0,1,3,4][currentStep]}/></div>}
