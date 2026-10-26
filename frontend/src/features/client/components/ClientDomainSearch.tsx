"use client";
import {useEffect,useState, type FormEvent} from "react";
import {Globe2,Search,ShieldCheck,AlertCircle} from "lucide-react";

type Lookup={domain:string;availability:string;checkout_enabled:boolean;registrar_connected:boolean;
  registration_price:string|null;renewal_price:string|null;currency:string|null;message:string};
export function ClientDomainSearch(){
  const [domain,setDomain]=useState("");
  const [value,setValue]=useState<Lookup|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{const value=new URLSearchParams(window.location.search).get("domain");
    if(value)setDomain(value.slice(0,253));},[]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");setValue(null);
    const query=domain.trim().toLowerCase().replace(/^https?:\/\//,"").replace(/\/$/,"");
    try{
      const r=await fetch(`https://api.cloud.octalve.com/api/storefront/domains/lookup/?domain=${encodeURIComponent(query)}`,{
        credentials:"omit",cache:"no-store"
      });
      if(!r.ok){setError("Please enter a valid domain name, for example yourbrand.com.");return;}
      setValue(await r.json() as Lookup);
    }catch{setError("Domain search is temporarily unavailable. No registration has been started.");}
    finally{setBusy(false)}
  }
  return <section id="domain-search" aria-label="Find a domain name" className="scroll-mt-24 overflow-hidden rounded-[24px] border border-[#DCE8F7] bg-white shadow-sm">
    <div className="bg-[linear-gradient(110deg,#001426,#073C7A)] px-5 py-6 text-white sm:px-7">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-200"><Globe2 className="h-4 w-4"/> Find your domain</div>
      <h2 className="mt-3 text-2xl font-bold tracking-tight">Your next big idea deserves the right name.</h2>
      <p className="mt-2 text-sm text-blue-100">Search domain extensions and see our published prices. Availability is confirmed with an approved registrar before purchase.</p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Domain name</span>
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400"/>
          <input required maxLength={253} value={domain} onChange={event=>setDomain(event.target.value)}
            placeholder="Search yourbusiness.com" className="h-12 w-full rounded-xl bg-white pl-12 pr-4 text-sm text-[#142A43] outline-none focus:ring-2 focus:ring-blue-300"/>
        </label>
        <button disabled={busy} type="submit" className="h-12 rounded-xl bg-[#0064E0] px-7 text-sm font-bold text-white transition hover:bg-[#0052B8] disabled:opacity-60">
          {busy?"Checking…":"Search domain"}
        </button>
      </form>
    </div>
    {error&&<p role="alert" className="px-5 py-4 text-sm text-rose-700"><AlertCircle className="mr-2 inline h-4 w-4"/>{error}</p>}
    {value&&<div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <div className="min-w-0"><h3 className="break-all text-lg font-bold text-[#142A43]">{value.domain}</h3>
        <p className="mt-1 text-xs font-medium text-amber-700">Availability requires registrar verification</p>
        <p className="mt-1 text-xs text-slate-500">{value.message}</p></div>
      <div className="shrink-0 text-left sm:text-right">
        {value.registration_price&&<p className="text-lg font-bold text-[#142A43]">Indicative {new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN"}).format(Number(value.registration_price))}/year</p>}
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><ShieldCheck className="h-4 w-4"/> No charge or registration initiated</p>
      </div>
    </div>}
  </section>;
}
