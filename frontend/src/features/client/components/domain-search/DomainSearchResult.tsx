import {DomainResultCard} from "@/components/shared-commerce/DomainCommerce";
import {AddToCartButton} from "../../checkout/AddToCartButton";
import type {DomainLookup} from "./domain-types";
import {formatDomainPrice} from "./domain-types";
export function DomainSearchAction({value,onAdded}:{value:DomainLookup;onAdded?:()=>void}){const verified=value.registrar_connected===true&&value.availability==="available";const priced=!!value.registration_price&&/^\d+(?:\.\d{1,2})?$/.test(value.registration_price)&&Number(value.registration_price)>0&&/^[A-Z]{3}$/.test(value.currency??"");return verified&&priced&&value.test_checkout_enabled?<AddToCartButton key={value.domain} onAdded={onAdded} item={{kind:"domain",domain:value.domain}}/>:null;}
export function DomainSearchResult({value,onAdded}:{value:DomainLookup;onAdded?:()=>void}){
 const verified=value.registrar_connected===true&&value.availability==="available";
 const unavailable=value.registrar_connected===true&&["registered","unavailable"].includes(value.availability);
 const priced=!!value.registration_price&&/^\d+(?:\.\d{1,2})?$/.test(value.registration_price)&&Number(value.registration_price)>0&&/^[A-Z]{3}$/.test(value.currency??"");
 return <section aria-label="Domain lookup result" aria-live="polite" className="px-4 pb-4 sm:px-6">
 <DomainResultCard name={value.domain} availability={verified?true:unavailable?false:null} price={priced?formatDomainPrice(value.registration_price!,value.currency)+"/yr":"Pricing unavailable"}
 renewal={value.renewal_price&&Number(value.renewal_price)>0&&value.currency? "Renews at "+formatDomainPrice(value.renewal_price,value.currency)+"/yr":undefined}
 action={<DomainSearchAction value={value} onAdded={onAdded}/>}
 notice={unavailable?"Choose another name or explore transfer.":!verified?"No domain has been reserved":undefined}/>
 <p className="mt-2 text-xs text-slate-600">{value.message}</p></section>;
}
