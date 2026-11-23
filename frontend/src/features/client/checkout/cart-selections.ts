import {authApi} from "@/lib/api/endpoints";

export type CartSelection = {kind:"domain";domain:string} | {kind:"service";plan:string;cycle:string;revision:number;domain?:string};
export const cartHref = "/client/order/checkout?view=cart";
export const cartChangedEvent = "octalve:cart-changed";

const domainPattern=/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function cartSelectionId(item:CartSelection){
  return item.kind==="domain" ? `domain:${item.domain}` : `service:${item.plan}:${item.cycle}${item.domain ? `:${item.domain}` : ""}`;
}

export function cartCheckoutHref(item:CartSelection){
  const params = item.kind==="domain"
    ? new URLSearchParams({product:"domain",domain:item.domain})
    : new URLSearchParams({plan:item.plan,cycle:item.cycle,revision:String(item.revision), ...(item.domain ? {forDomain:item.domain} : {})});
  return `/client/order/checkout?${params}`;
}

function valid(item:unknown):item is CartSelection {
  if (!item || typeof item!=="object" || !("kind" in item)) return false;
  if (item.kind==="domain") return "domain" in item && typeof item.domain==="string" && domainPattern.test(item.domain);
  return item.kind==="service" && "plan" in item && typeof item.plan==="string" && /^[1-9]\d{0,11}$/.test(item.plan)
    && "cycle" in item && typeof item.cycle==="string" && /^[a-z0-9_-]{1,25}$/i.test(item.cycle)
    && "revision" in item && typeof item.revision==="number" && Number.isSafeInteger(item.revision) && item.revision>0 && (!("domain" in item) || item.domain===undefined || (typeof item.domain==="string" && domainPattern.test(item.domain)));
}

async function accountCartKey(email?: string){
  const address = email ?? (await authApi.profile()).email;
  if (!address) throw new Error("Cart account is unavailable.");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(address.toLowerCase()));
  return `octalve-draft-cart:${Array.from(new Uint8Array(digest), byte=>byte.toString(16).padStart(2,"0")).join("")}`;
}

function read(key:string):CartSelection[]{
  try {
    const value:unknown=JSON.parse(sessionStorage.getItem(key) ?? "[]");
    return Array.isArray(value)?value.filter(valid).slice(0,20):[];
  } catch {return [];}
}

export async function readCart(email?: string){return read(await accountCartKey(email));}

function write(key: string, items: CartSelection[]) {
  sessionStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new Event(cartChangedEvent));
}

export async function addToCart(item:CartSelection){
  if (!valid(item)) throw new Error("Choose a current offer before adding it.");
  const key=await accountCartKey();
  const rest=read(key).filter(saved=>cartSelectionId(saved)!==cartSelectionId(item));
  if(rest.length>=20) throw new Error("The cart has reached its item limit.");
  write(key, [...rest, item]);
}

export async function removeFromCart(id:string){
  const key=await accountCartKey();
  const rest=read(key).filter(saved=>cartSelectionId(saved)!==id);
  write(key, rest);
  return rest;
}
