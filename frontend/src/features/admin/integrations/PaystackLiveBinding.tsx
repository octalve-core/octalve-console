"use client";
import {useEffect,useState,type FormEvent} from "react";
import {api} from "@/lib/api/client";
import type {DraftConnection} from "./connection-readback";
type ExceptionCase={id:number;event:string;state:string;case:{kind:string;case_id:string;state:string;amount_minor:number|null;currency:string|null}|null;created_at:string};
function FinancialExceptionReview(){
 const [rows,setRows]=useState<ExceptionCase[]|null>(null),[error,setError]=useState(false),[loading,setLoading]=useState(false);
 async function refresh(){setLoading(true);setError(false);try{const r=await api.get<{cases:ExceptionCase[]}>("/payments/admin/financial-exceptions/");setRows(r.cases)}catch{setError(true);setRows(null)}finally{setLoading(false)}}
 return <section className="space-y-2 rounded-lg border border-console-line p-3">
  <h4 className="text-sm font-medium">Financial exception review</h4>
  <p className="text-xs text-console-muted">Verified refund, dispute and payment exception evidence. No money is moved from this view.</p>
  <button type="button" disabled={loading} onClick={()=>void refresh()} className="min-h-10 rounded-lg border border-console-line px-3 text-xs">{loading?"Loading…":"Load financial cases"}</button>
  {error?<p role="alert" className="text-xs text-rose-700">Review unavailable.</p>:null}
  {rows?.length===0?<p className="text-xs text-console-muted">No recorded live cases.</p>:null}
  {rows?.map(row=><div key={row.id} className="break-words rounded-lg border border-console-line p-2 text-xs"><p className="font-medium">{row.event}</p><p>{row.state.replaceAll("_"," ")} · {new Date(row.created_at).toLocaleString("en-GB")}</p>{row.case?<p>Provider case {row.case.case_id} · {row.case.state}{row.case.amount_minor!==null&&row.case.currency?" · "+row.case.currency+" "+(row.case.amount_minor/100).toFixed(2):""}</p>:null}</div>)}
 </section>
}
type Status={binding_available:boolean;gateway_state:"live_bound"|"not_bound";connections:{id:string}[]};
export function PaystackLiveBinding({connection,onSaved}:{connection:DraftConnection;onSaved?:()=>void}){
 const [state,setState]=useState<Status|null>(null),[working,setWorking]=useState(false),[message,setMessage]=useState(""),[failed,setFailed]=useState(false);
 useEffect(()=>{let active=true;void api.get<Status>("/payments/admin/paystack-live-binding/").then(result=>{if(active)setState(result)}).catch(()=>{if(active)setState(null)});return()=>{active=false}},[connection.id,connection.credential_version]);
 async function bind(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(working||!state?.binding_available||!state.connections.some(c=>c.id===connection.id))return;
  const form=event.currentTarget,fields=new FormData(form);
  const input={connection_id:connection.id,confirm_password:String(fields.get("password")||""),totp_code:String(fields.get("totp")||""),accept_live:fields.get("accept")==="on"};
  form.reset();setWorking(true);setMessage("");setFailed(false);
  try{
   const result=await api.post<{gateway_state:string;binding_version:number}>("/payments/admin/paystack-live-binding/",input);
   if(result.gateway_state!=="live_bound"||result.binding_version!==connection.credential_version)throw Error("Invalid binding response");
   setMessage("Live credential bound. Collection and reconciliation require their separate release gates.");onSaved?.();
  }catch{setFailed(true);setMessage("Binding could not be approved. Verify the key, authenticator and resolve outstanding test/live transactions before changing gateway authority.");}
  finally{setWorking(false);}
 }
 const field="mt-1 min-h-11 w-full rounded-lg border border-console-line px-3 text-sm";
 return <section className="mt-3 space-y-3 rounded-xl border border-console-line bg-white p-3">
  <h3 className="text-sm font-medium">Live Paystack gateway</h3>
  <p className="text-xs text-console-muted">Bind the verified live key without copying it. Existing unresolved payment intents or signed events prevent changing gateway mode. No charge is initiated here.</p>
  <p className="text-xs text-console-muted">Binding: {state?.gateway_state==="live_bound"?"Live authority configured":state?"Not bound":"Status unavailable"}</p>
  {state?.binding_available?<form onSubmit={bind} className="space-y-3">
   <label className="block text-xs">Current account password<input name="password" type="password" autoComplete="current-password" required className={field}/></label>
   <label className="block text-xs">Fresh authenticator code<input name="totp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required className={field}/></label>
   <label className="flex items-start gap-2 text-xs"><input type="checkbox" name="accept" required/>Approve live gateway binding for this exact saved connection.</label>
   <button disabled={working} className="min-h-11 rounded-lg bg-console-primary px-3 text-sm font-medium text-white disabled:opacity-50">{working?"Verifying…":"Bind live key"}</button>
  </form>:<p className="text-xs text-console-muted">Live binding is held until the platform security and release prerequisites are approved.</p>}
  <FinancialExceptionReview/>
  {message&&<p role={failed?"alert":"status"} className={"text-xs "+(failed?"text-rose-700":"text-emerald-700")}>{message}</p>}
 </section>
}
