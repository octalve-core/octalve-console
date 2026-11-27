import {PublishedExtensionGrid} from "@/components/shared-commerce/DomainCommerce";
import type {ReactNode} from "react";
import {formatDomainPrice,type PublishedDomainPrice} from "./domain-types";
export function PublishedDomainCatalogue({prices,currency,selected,onSelect,renderAction}:{prices:PublishedDomainPrice[];currency:string;selected?:string;onSelect:(tld:string)=>void;renderAction?:(tld:string)=>ReactNode}){
 return <PublishedExtensionGrid prices={prices.filter(p=>/^\.[a-z0-9.-]{2,30}$/.test(p.tld)&&Number(p.registration_price)>0).map(p=>({tld:p.tld,price:formatDomainPrice(p.registration_price,currency),renewal:Number(p.renewal_price)>0?formatDomainPrice(p.renewal_price,currency):undefined}))} selected={selected} onSelect={onSelect} renderAction={renderAction}/>;
}
