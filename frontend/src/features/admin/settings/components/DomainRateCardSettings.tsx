"use client";

import {useEffect,useState,type FormEvent} from "react";
import {AlertTriangle,CheckCircle2,RefreshCcw,ShieldCheck} from "lucide-react";
import {api} from "@/lib/api/client";

type Period="1"|"2"|"5"|"10";
type Prices=Record<Period,string|null>;
type RateCard={
 tld:string;description:string;currency:"NGN";registration:Prices;renewal:Prices;
 transfer_price:string;revision:number;updated_at:string;publication:"inactive_draft";
 registrar_quote_verified:false;checkout_enabled:false;
};
type RateResponse={results:RateCard[];truncated:boolean;currency:"NGN";checkout_enabled:false};
const TERMS:Period[]=["1","2","5","10"];
const EMPTY:Prices={"1":"","2":null,"5":null,"10":null};
function blank():RateCard{
 return {tld:"",description:"",currency:"NGN",registration:{...EMPTY},
  renewal:{...EMPTY},transfer_price:"",revision:0,updated_at:"",
  publication:"inactive_draft",registrar_quote_verified:false,checkout_enabled:false};
}
const field="min-h-11 w-full rounded-xl border border-console-line bg-white px-3 py-2 text-sm text-console-ink focus-visible:outline-2 focus-visible:outline-console-primary";
export function DomainRateCardSettings(){
 const [cards,setCards]=useState<RateCard[]>([]);
 const [selected,setSelected]=useState("");
 const [draft,setDraft]=useState<RateCard>(blank);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [truncated,setTruncated]=useState(false);
 async function load(prefer?:string){
  setLoading(true);setError("");
  try{
   const result=await api.get<RateResponse>("/domains/admin/tld-price-cards/");
   if(!result||!Array.isArray(result.results)||result.currency!=="NGN"||
      result.checkout_enabled!==false)throw Error("Invalid rate-card response");
   setCards(result.results);setTruncated(result.truncated===true);
   const chosen=prefer??selected;
   const row=result.results.find(item=>item.tld===chosen);
   if(row){setSelected(row.tld);setDraft({...row,registration:{...row.registration},renewal:{...row.renewal}});}
   else if(!prefer&&result.results.length&&!selected){
    const first=result.results[0];setSelected(first.tld);
    setDraft({...first,registration:{...first.registration},renewal:{...first.renewal}});
   }else{setSelected("");setDraft(blank());}
  }catch{setError("Unable to load protected TLD pricing. Your permissions or the API may not be ready.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();/* load is intentionally mount-only */},[]);// eslint-disable-line react-hooks/exhaustive-deps
 function choose(value:string){
  setNotice("");setError("");setSelected(value);
  const item=cards.find(row=>row.tld===value);
  setDraft(item?{...item,registration:{...item.registration},renewal:{...item.renewal}}:blank());
 }
 function setPrice(field:"registration"|"renewal",period:Period,value:string){
  setDraft(prev=>({...prev,[field]:{...prev[field],[period]:value}}));
 }
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(saving||loading)return;
  const form=e.currentTarget;
  const formData=new FormData(form);
  const password=String(formData.get("confirm_password")||"");
  const totp_code=String(formData.get("totp_code")||"");
  const cleanup=(value:Prices)=>Object.fromEntries(
   TERMS.map(year=>[year,value[year]?.trim()||null])) as Prices;
  const registration=cleanup(draft.registration);
  const renewal=cleanup(draft.renewal);
  if(!registration["1"]||!renewal["1"]||!draft.transfer_price.trim()){
   setError("Enter one-year registration, renewal and transfer prices.");return;
  }
  setSaving(true);setError("");setNotice("");
  try{
   const saved=await api.post<RateCard>("/domains/admin/tld-price-cards/",{
    tld:draft.tld.trim(),description:draft.description,
    registration,renewal,transfer_price:draft.transfer_price.trim(),
    expected_revision:draft.revision,confirm_password:password,totp_code
   });
   if(saved.publication!=="inactive_draft"||saved.checkout_enabled!==false||
      saved.tld!==draft.tld.trim()||saved.revision!==draft.revision+1)
    throw Error("Invalid save receipt");
   setNotice("Saved and audited as a draft. No registrar quote, charge or domain purchase was enabled.");
   setSelected(saved.tld);setDraft(saved);
   setCards(prev=>[saved,...prev.filter(item=>item.tld!==saved.tld)]
    .sort((a,b)=>a.tld.localeCompare(b.tld)));
  }catch{setError("Price card could not be saved. Check your Super Admin password and latest revision; refresh if another administrator edited it.");}
  finally{
   const passwordInput=form.elements.namedItem("confirm_password");
   if(passwordInput instanceof HTMLInputElement)passwordInput.value="";
   const totpInput=form.elements.namedItem("totp_code");
   if(totpInput instanceof HTMLInputElement)totpInput.value="";
   setSaving(false);
  }
 }
 return <section className="min-w-0 space-y-5 xl:col-span-3" aria-label="TLD price management">
  <div className="rounded-2xl border border-console-line bg-white p-5 shadow-sm">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
     <h2 className="text-base font-medium text-console-ink">TLD registration and renewal rates</h2>
     <p className="mt-1 max-w-2xl text-xs leading-5 text-console-muted">
      Set NGN totals for 1, 2, 5 or 10 years. Use blank for terms the registrar cannot offer.
      These are internal drafts—not real-time availability, executable quotes or checkout prices.
     </p>
    </div>
    <button type="button" onClick={()=>void load(selected)} disabled={loading||saving}
     className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-console-line px-3 text-xs font-medium text-console-primary disabled:opacity-50">
     <RefreshCcw className="h-4 w-4"/>Refresh</button>
   </div>
   {error?<p role="alert" className="mt-4 flex items-start gap-2 text-xs text-rose-700">
    <AlertTriangle className="h-4 w-4 shrink-0"/>{error}</p>:null}
   {notice?<p role="status" className="mt-4 flex items-start gap-2 text-xs text-emerald-700">
    <CheckCircle2 className="h-4 w-4 shrink-0"/>{notice}</p>:null}
   {truncated?<p className="mt-3 text-xs text-amber-700">More than 300 TLDs exist. Contact an operator before editing further records.</p>:null}
   {loading?<p role="status" className="mt-4 text-xs text-console-muted">Loading saved rate cards…</p>:null}
   {!loading?<form onSubmit={save} autoComplete="off" className="mt-5 space-y-5">
    <div className="grid gap-4 md:grid-cols-2">
     <label className="text-xs text-console-ink">Choose a saved TLD or create a new draft
      <select className={field+" mt-1"} value={selected} onChange={e=>choose(e.target.value)}>
       <option value="">New TLD price card</option>
       {cards.map(item=><option key={item.tld} value={item.tld}>{item.tld} (revision {item.revision})</option>)}
      </select>
     </label>
     <label className="text-xs text-console-ink">TLD
      <input required className={field+" mt-1"} value={draft.tld} disabled={Boolean(selected)}
       onChange={e=>setDraft(prev=>({...prev,tld:e.target.value.toLowerCase()}))}
       pattern="\.[a-z0-9.-]+" maxLength={50} placeholder=".com or .com.ng" autoComplete="off"/>
     </label>
    </div>
    <label className="block text-xs text-console-ink">Internal note (optional)
     <input value={draft.description} onChange={e=>setDraft(prev=>({...prev,description:e.target.value}))}
      className={field+" mt-1"} maxLength={500} placeholder="Registrar programme or pricing notes"/>
    </label>
    <div className="grid gap-4 lg:grid-cols-2">
     {(["registration","renewal"] as const).map(operation=><fieldset key={operation}
      className="min-w-0 rounded-xl border border-console-line p-4">
      <legend className="px-1 text-sm font-medium capitalize text-console-ink">{operation} price · NGN total</legend>
      <div className="grid gap-3 sm:grid-cols-2">
       {TERMS.map(year=><label key={year} className="block text-xs text-console-ink">
        {year} {year==="1"?"year":"years"} {year==="1"?"(required)":"(optional)"}
        <input type="text" inputMode="decimal" className={field+" mt-1"} required={year==="1"}
         pattern="(?:0|[1-9][0-9]{0,7})\.[0-9]{2}"
         value={draft[operation][year]??""} placeholder="0.00"
         onChange={e=>setPrice(operation,year,e.target.value)}/>
       </label>)}
      </div>
     </fieldset>)}
    </div>
    <div className="grid gap-3 md:grid-cols-2 md:items-end">
     <label className="text-xs text-console-ink">One-year transfer price · NGN
      <input type="text" inputMode="decimal" required
       pattern="(?:0|[1-9][0-9]{0,7})\.[0-9]{2}"
       className={field+" mt-1"} placeholder="0.00" value={draft.transfer_price}
       onChange={e=>setDraft(prev=>({...prev,transfer_price:e.target.value}))}/>
     </label>
     <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-console-muted">
      Existing domains cannot be renewed or registered using these prices without a fresh
      approved registrar quote, supplier fulfillment and confirmed payment.
     </p>
    </div>
    <div className="flex flex-wrap items-end justify-between gap-4 border-t border-console-line pt-4">
     <label className="block min-w-60 flex-1 text-xs text-console-ink">
      Super Admin account password
      <input name="confirm_password" type="password" required autoComplete="off" className={field+" mt-1"}/>
     </label>
     <label className="block min-w-52 flex-1 text-xs text-console-ink">
      Fresh six-digit authenticator code
      <input name="totp_code" inputMode="numeric" type="text" pattern="[0-9]{6}"
       maxLength={6} required autoComplete="one-time-code" className={field+" mt-1"}/>
     </label>
     <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-console-primary px-5 py-2 text-sm font-medium text-white disabled:opacity-50">
      {saving?"Saving and auditing…":"Save draft prices"}
     </button>
    </div>
    <div className="flex items-center gap-2 text-xs text-console-muted">
     <ShieldCheck className="h-4 w-4 text-console-primary"/>
     Prices remain unpublished until supplier and release qualification. Every edit is audited.
    </div>
   </form>:null}
  </div>
 </section>;
}
