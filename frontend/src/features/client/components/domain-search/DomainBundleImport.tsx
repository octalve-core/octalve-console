"use client";
import {useEffect,useState} from "react";
import {addDomainBundle} from "../../checkout/cart-selections";
export function DomainBundleImport(){
 const [names,setNames]=useState<string[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 useEffect(()=>{const p=new URLSearchParams(window.location.search);const raw=p.get("bundle");if(raw)setNames(raw.split(",").slice(0,5));},[]);
 if(!names.length)return null;
 async function add(){if(busy)return;setBusy(true);setError("");try{await addDomainBundle(names);window.location.assign("/client/order/checkout?view=cart");}catch(e){setError(e instanceof Error?e.message:"Could not add domains.");setBusy(false)}}
 return <section className="rounded-xl border border-console-line bg-white p-5"><h2 className="text-lg font-medium">Your domain selection</h2><p className="mt-2 text-sm text-console-muted">Review these domains before adding them to your draft cart. Availability is rechecked. Live payment remains subject to checkout eligibility.</p><ul className="my-4 space-y-1 text-sm">{names.map((name,i)=><li key={i} className="break-all">{name}</li>)}</ul><button type="button" disabled={busy} onClick={()=>void add()} className="min-h-11 rounded-lg bg-console-primary px-5 text-sm font-medium text-white disabled:opacity-50">{busy?"Verifying…":"Add selected domains to cart"}</button>{error&&<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}</section>
}
