import {authApi} from "@/lib/api/endpoints";

export type CartSelection = {kind:"domain";domain:string} | {kind:"service";plan:string;cycle:string;revision:number;domain?:string};
export const cartHref = "/client/order/checkout?view=cart";
export const cartChangedEvent = "octalve:cart-changed";
export const cartAddedEvent = "octalve:cart-added";

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

const accountEndpoint="/api/cloud/orders/shopping/account";

export type AccountSnapshot={lines:{id:string;selection:CartSelection;ready:boolean;kind?:string;name?:string;currency?:string;amount?:string;renewal?:string;period?:string}[];subtotal:string|null;currency:string|null;domains?:string[]};

export async function accountCartSnapshot(method:"GET"|"POST"|"DELETE"|"PATCH"="GET",data?:unknown):Promise<AccountSnapshot|null>{
  const result=await fetch(accountEndpoint,{
    method,cache:"no-store",credentials:"same-origin",signal:AbortSignal.timeout(15000),
    ...(data?{headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}:{}),
  });
  if(result.status===404)return null;
  if(!result.ok)throw Error("Your cart could not be updated.");
  const body=await result.json() as AccountSnapshot;
  if(!Array.isArray(body.lines))throw Error("Invalid cart response.");
  const selections=body.lines.map(line=>line.selection);
  if(!selections.every(valid))throw Error("Invalid cart selection.");
  return body;
}

async function accountRequest(method:"GET"|"POST"|"DELETE",data?:unknown):Promise<CartSelection[]|null>{const body=await accountCartSnapshot(method,data);return body?.lines.map(line=>line.selection)??null;}

const activeImports=new Map<string,Promise<CartSelection[]|null>>();

async function importGuestAndLocal(key:string):Promise<CartSelection[]|null>{
  const account=await accountRequest("GET");
  if(!account)return null;
  const local=read(key);
  if(local.length){
    if(await accountCartKey()!==key)throw Error("Account changed. Reopen the cart.");
    await accountRequest("POST",{selections:local});
    sessionStorage.removeItem(key);
  }
  const grantResponse=await fetch("/api/cloud/orders/shopping/grant",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(8000),
  });
  if(!grantResponse.ok)throw Error("Your guest cart could not be checked.");
  const payload=await grantResponse.json() as {grant?:unknown};
  if(typeof payload.grant!=="string"||payload.grant.length>300)throw Error("Invalid cart handoff.");
  if(await accountCartKey()!==key)throw Error("Account changed. Reopen the cart.");
  const claim=await fetch("https://api.cloud.octalve.com/api/orders/shopping/claim/",{
    method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({grant:payload.grant}),
    signal:AbortSignal.timeout(8000),
  });
  if(!claim.ok)throw Error("Your guest cart could not be merged.");
  return accountRequest("GET");
}

export async function readCart(email?: string){
  const key=await accountCartKey(email);
  if(location.pathname==="/client/order/checkout"&&new URLSearchParams(location.search).get("view")==="cart"){
    let pending=activeImports.get(key);
    if(!pending){
      pending=importGuestAndLocal(key).finally(()=>{activeImports.delete(key);});
      activeImports.set(key,pending);
    }
    const merged=await pending;
    if(await accountCartKey()!==key)throw Error("Account changed. Reopen the cart.");
    return merged??read(key);
  }
  return (await accountRequest("GET"))??read(key);
}

function write(key: string, items: CartSelection[]) {
  sessionStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new Event(cartChangedEvent));
}

export async function addToCart(item:CartSelection){
  if (!valid(item)) throw new Error("Choose a current offer before adding it.");
  const key=await accountCartKey();
  const remote=await accountRequest("POST",{selections:[item]});
  if(remote!==null){window.dispatchEvent(new Event(cartChangedEvent));window.dispatchEvent(new Event(cartAddedEvent));return;}
  const rest=read(key).filter(saved=>cartSelectionId(saved)!==cartSelectionId(item));
  if(rest.length>=20) throw new Error("The cart has reached its item limit.");
  write(key, [...rest, item]);
  window.dispatchEvent(new Event(cartAddedEvent));
}

export async function removeFromCart(id:string){
  const key=await accountCartKey();
  const remote=await accountRequest("DELETE",{id});
  if(remote!==null){window.dispatchEvent(new Event(cartChangedEvent));return remote;}
  const rest=read(key).filter(saved=>cartSelectionId(saved)!==id);
  write(key, rest);
  return rest;
}

/** Import identifiers only after rechecking the public registrar. One atomic draft write. */
export async function addDomainBundle(names:string[]){
 if(!Array.isArray(names)||names.length<1||names.length>4||new Set(names).size!==names.length||!names.every(name=>typeof name==="string"&&domainPattern.test(name)))throw Error("Invalid domain selection.");
 const key=await accountCartKey();
 const api=process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/,"")||"https://api.cloud.octalve.com/api";
 const results=await Promise.all(names.map(async name=>{
  const response=await fetch(api+"/storefront/domains/lookup/?domain="+encodeURIComponent(name),{credentials:"omit",cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error("Could not verify every domain.");
  const value=await response.json();
  if(value.domain!==name||value.registrar_connected!==true||value.availability!=="available"||!Number.isFinite(Number(value.registration_price))||Number(value.registration_price)<=0)throw Error("A selected domain is no longer available or priced.");
  return {kind:"domain" as const,domain:name};
 }));
 if(await accountCartKey()!==key)throw Error("Account changed. Please retry.");
 const remote=await accountRequest("POST",{selections:results});
 if(remote!==null){window.dispatchEvent(new Event(cartChangedEvent));window.dispatchEvent(new Event(cartAddedEvent));return;}
 const merged=new Map(read(key).map(item=>[cartSelectionId(item),item]));
 for(const item of results)merged.set(cartSelectionId(item),item);
 if(merged.size>20)throw Error("Your cart can contain up to 20 items.");
 write(key,[...merged.values()]);
 window.dispatchEvent(new Event(cartAddedEvent));
}
