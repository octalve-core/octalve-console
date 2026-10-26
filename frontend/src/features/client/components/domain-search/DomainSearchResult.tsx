import {BadgeCheck,Info,ShieldCheck} from "lucide-react";
import type {DomainLookup} from "./domain-types";
import {formatDomainPrice} from "./domain-types";

export function DomainSearchResult({value}:{value:DomainLookup}){
 const verified=value.registrar_connected&&value.availability==="available";
 return <section aria-label="Domain lookup result"
   className="flex flex-col gap-4 border-t border-[#E5EBF3] bg-[#F8FAFD] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
   <div className="min-w-0">
     <div className="flex flex-wrap items-center gap-2">
       <span className="break-all text-xl font-bold tracking-tight text-[#071425]">{value.domain}</span>
       <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${verified?"bg-emerald-100 text-emerald-700":"bg-amber-100 text-amber-800"}`}>
         {verified?"Availability confirmed":"Availability not yet verified"}
       </span>
     </div>
     <p className="mt-2 max-w-2xl text-xs leading-6 text-[#64748B]">{value.message}</p>
   </div>
   <div className="shrink-0">
     {value.registration_price&&<p className="text-xl font-bold text-[#142A43]">
       {formatDomainPrice(value.registration_price,value.currency)}<span className="ml-1 text-xs font-medium text-[#64748B]">/year, indicative</span>
     </p>}
     <p className="mt-2 flex items-center gap-2 text-xs font-medium text-[#61738B]">
       {verified?<BadgeCheck className="h-4 w-4 text-emerald-600"/>:<Info className="h-4 w-4 text-amber-600"/>}
       {verified?"Registration can continue once checkout is enabled":"No registration or payment has been started"}
     </p>
   </div>
 </section>;
}
