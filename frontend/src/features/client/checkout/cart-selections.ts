import {authApi} from "@/lib/api/endpoints";

export type CartSelection = {kind:"domain";domain:string} | {kind:"service";plan:string;cycle:string;revision:number};
const domainPattern=/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function cartSelectionId(item:CartSelection){
  return item.kind==="domain" ? `domain:${item.domain}` : `service:${item.plan}:${item.cycle}`;
}

export function cartCheckoutHref(item:CartSelection){
  const params = item.kind==="domain"
    ? new URLSearchParams({product:"domain",domain:item.domain})
    : new URLSearchParams({plan:item.plan,cycle:item.cycle,revision:String(item.revision)});
  return `/client/order/checkout?${params}`;
}

function valid(item:unknown):item is CartSelection {
  if (!item || typeof item!=="object" || !("kind" in item)) return false;
  if (item.kind==="domain") return "domain" in item && typeof item.domain==="string" && domainPattern.test(item.domain);
  return item.kind==="service" && "plan" in item && typeof item.plan==="string" && /^[1-9]\d{0,11}$/.test(item.plan)
    && "cycle" in item && typeof item.cycle==="string" && /^[a-z0-9_-]{1,25}$/i.test(item.cycle)
    && "revision" in item && typeof item.revision==="number" && Number.isSafeInteger(item.revision) && item.revision>0;
}

async function accountCartKey(){
  const profile=await authApi.profile();
  if (!profile.email) throw new Error("Cart account is unavailable.");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(profile.email.toLowerCase()));
  return `octalve-draft-cart:${Array.from(new Uint8Array(digest), byte=>byte.toString(16).padStart(2,"0")).join("")}`;
}

function read(key:string):CartSelection[]{
  try {
    const value:unknown=JSON.parse(sessionStorage.getItem(key) ?? "[]");
    return Array.isArray(value)?value.filter(valid).slice(0,20):[];
  } catch {return [];}
}

export async function readCart(){return read(await accountCartKey());}

export async function addToCart(item:CartSelection){
  if (!valid(item)) throw new Error("Choose a current offer before adding it.");
  const key=await accountCartKey();
  const rest=read(key).filter(saved=>cartSelectionId(saved)!==cartSelectionId(item));
  if(rest.length>=20) throw new Error("The cart has reached its item limit.");
  sessionStorage.setItem(key,JSON.stringify([...rest,item]));
}

export async function removeFromCart(id:string){
  const key=await accountCartKey();
  const rest=read(key).filter(saved=>cartSelectionId(saved)!==id);
  sessionStorage.setItem(key,JSON.stringify(rest));
  return rest;
}
