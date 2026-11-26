import type {DomainPickerOffer} from "./types";
const domain=/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;
export const pickerExtensions=[".com",".ng",".com.ng",".net",".org",".ai",".cloud",".shop"] as const;
export function canSelectOffer(offer:DomainPickerOffer){return offer.available===true&&offer.selectable===true&&domain.test(offer.domain)}
export function uniquePickerOffers(offers:readonly DomainPickerOffer[]){const seen=new Set<string>();return offers.filter(o=>o&&typeof o.domain==="string"&&domain.test(o.domain)&&!seen.has(o.domain)&&!!seen.add(o.domain)).slice(0,8)}
