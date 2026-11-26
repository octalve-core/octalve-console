import type {CartLine,DomainPickerActions,ProductKind} from "@/components/shared-commerce/types";
import {pickerExtensions} from "@/components/shared-commerce/domain-picker-model";
import type {AccountSnapshot} from "./cart-selections";
import {formatPlanAmount} from "../data/client-order-data";
const kinds:ProductKind[]=["domain","hosting","vps","email","ssl"];
export function sharedCartLines(snapshot:AccountSnapshot):CartLine[]{
 const domains=[...new Set([...(snapshot.domains??[]),...snapshot.lines.flatMap(l=>l.ready&&l.selection.kind==="domain"?[l.selection.domain]:[])])];
 return snapshot.lines.map(l=>({id:l.id,kind:l.kind&&kinds.includes(l.kind as ProductKind)?l.kind as ProductKind:l.selection.kind==="domain"?"domain":"hosting",name:l.name??l.selection.domain??"Service selection",description:"",period:!l.ready?(l.issue??"Review this selection"):l.period??"Check availability",priceLabel:l.amount&&l.currency?formatPlanAmount(Number(l.amount),l.currency):"Price unavailable",renewalLabel:l.renewal&&l.currency?formatPlanAmount(Number(l.renewal),l.currency)+" renewal":undefined,domain:l.selection.domain,domainOptions:l.ready&&l.selection.kind==="service"?domains:undefined}));
}
export const searchCartDomains:DomainPickerActions["search"]=async(query,extension,signal)=>{
 const name=query.trim().toLowerCase();
 if(!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name))throw Error("Enter a valid domain or business name.");
 const domains=name.includes(".")?[name]:[...(extension?[extension]:pickerExtensions)].map(t=>name+t);
 return Promise.all(domains.map(async domain=>{
  const unknown={domain,available:null,priceLabel:"Pricing unavailable",selectable:false};
  try{const r=await fetch("https://api.cloud.octalve.com/api/storefront/domains/lookup/?domain="+encodeURIComponent(domain),{credentials:"omit",cache:"no-store",signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});
   if(!r.ok)return unknown;const d=await r.json();
   if(d.domain!==domain)return unknown;
   const available=d.registrar_connected===true&&d.availability==="available"?true:d.registrar_connected===true&&["registered","unavailable"].includes(d.availability)?false:null;
   const valid=(n:unknown)=>typeof n==="string"&&/^\d+(?:\.\d{1,2})?$/.test(n)&&Number(n)>0;
   const currency=typeof d.currency==="string"&&/^[A-Z]{3}$/.test(d.currency)?d.currency:null;
   return {domain,available,selectable:available===true&&!!currency&&valid(d.registration_price),priceLabel:currency&&valid(d.registration_price)?formatPlanAmount(Number(d.registration_price),currency)+"/yr":"Pricing pending",renewalLabel:currency&&valid(d.renewal_price)?formatPlanAmount(Number(d.renewal_price),currency)+" renewal":undefined,checkoutEnabled:d.checkout_enabled===true};
  }catch{return unknown;}
 }));
};
