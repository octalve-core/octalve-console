import {BadgeCheck,Info} from "lucide-react";
import {StatusBadge} from "@/components/design-system/StatusBadge";
import {AddToCartButton} from "../../checkout/AddToCartButton";
import type {DomainLookup} from "./domain-types";
import {formatDomainPrice} from "./domain-types";

export function DomainSearchResult({value,onAdded}:{value:DomainLookup;onAdded?:()=>void}){
 const verified=value.registrar_connected&&value.availability==="available";
 const unavailable=value.registrar_connected&&(value.availability==="registered"||value.availability==="unavailable");
 return <section aria-label="Domain lookup result" aria-live="polite"
   className="flex flex-col gap-4 border-t border-[#E5EBF3] bg-[#F8FAFD] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
   <div className="min-w-0">
     <div className="flex flex-wrap items-center gap-2">
       <span className="break-all text-xl font-medium tracking-tight text-[#071425]">{value.domain}</span>
       <StatusBadge tone={verified?"success":"warning"}>
         {verified?"Available":unavailable?"Unavailable":"Availability not yet verified"}
       </StatusBadge>
     </div>
     <p className="mt-2 max-w-2xl text-xs leading-6 text-[#64748B]">{value.message}</p>
   </div>
   <div className="min-w-0 sm:shrink-0">
     {value.registration_price&&<p className="text-xl font-medium text-[#142A43]">
       {formatDomainPrice(value.registration_price,value.currency)}<span className="ml-1 text-xs font-medium text-[#64748B]">/year, indicative</span>
     </p>}
     {value.renewal_price && Number(value.renewal_price)>0 && <p className="mt-1 text-sm text-slate-700">Renews at {formatDomainPrice(value.renewal_price,value.currency)} / year</p>}
     <p className="mt-2 flex items-center gap-2 text-xs font-medium text-[#61738B]">
       {verified?<BadgeCheck className="h-4 w-4 text-emerald-600"/>:<Info className="h-4 w-4 text-amber-600"/>}
       {verified?"Availability rechecked at checkout":"No domain has been reserved"}
     </p>
     {verified&&value.test_checkout_enabled?<AddToCartButton key={value.domain} className="mt-3" onAdded={onAdded} item={{kind:"domain",domain:value.domain}}/>:null}
   </div>
 </section>;
}
