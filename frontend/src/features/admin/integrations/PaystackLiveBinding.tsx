"use client";
import {useEffect,useState,type FormEvent} from "react";
import {api} from "@/lib/api/client";
import type {DraftConnection} from "./connection-readback";
type ExceptionCase={id:number;event:string;state:string;case:{kind:string;case_id:string;state:string;amount_minor:number|null;currency:string|null}|null;created_at:string};
type RefundRequest={payment:string;reference:string;amount_minor:number;state:string};
function RefundRequestForm(){
 const [working,setWorking]=useState(false),[message,setMessage]=useState(""),[failed,setFailed]=useState(false);
 async function send(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(working)return;const form=event.currentTarget,fields=new FormData(form);
  const raw=String(fields.get("amount")||"");if(!/^\d{1,10}(?:\.\d{1,2})?$/.test(raw)){setFailed(true);setMessage("Enter a valid NGN amount.");return;}
  const [whole,fraction=""]=raw.split(".");const minor=Number(whole)*100+Number(fraction.padEnd(2,"0"));
  if(!Number.isSafeInteger(minor)||minor<=0){setFailed(true);setMessage("Enter a positive amount.");return;}
  const input={transaction_public_id:String(fields.get("payment")||"").trim(),amount_minor:minor,
    confirm_password:String(fields.get("password")||""),totp_code:String(fields.get("totp")||""),confirm_refund:fields.get("confirm")==="on"};
  form.reset();setWorking(true);setFailed(false);setMessage("");
  try{const result=await api.post<{reference:string;state:string}>("/payments/admin/refunds/request/",input);
    setMessage("Refund request "+result.reference+" · "+result.state+". Final movement requires provider confirmation. Do not submit again while unresolved.");
  }catch{setFailed(true);setMessage("Refund could not be qualified. Check the financial review before any further request.");}finally{setWorking(false)}
 }
 const field="mt-1 min-h-11 w-full rounded-lg border border-console-line px-3 text-sm";
 return <form onSubmit={send} className="space-y-2 rounded-lg border border-console-line p-3">
 <h4 className="text-sm font-medium">Request live refund</h4>
 <p className="text-xs text-console-muted">This authorizes real money movement. Use the original verified payment's public UUID. An unresolved result is never automatically resubmitted.</p>
 <label className="block text-xs">Payment UUID<input name="payment" required maxLength={36} className={field}/></label>
 <label className="block text-xs">Refund amount (NGN)<input name="amount" inputMode="decimal" required className={field}/></label>
 <label className="block text-xs">Current password<input type="password" name="password" autoComplete="current-password" required className={field}/></label>
 <label className="block text-xs">Authenticator code<input name="totp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" className={field}/></label>
 <label className="flex gap-2 text-xs"><input name="confirm" type="checkbox" required/>I authorize the exact refund amount for this original payment.</label>
 <button type="submit" disabled={working} className="min-h-11 rounded-lg border border-console-line px-3 text-xs">{working?"Submitting…":"Authorize refund"}</button>
 {message?<p role={failed?"alert":"status"} className="break-words text-xs">{message}</p>:null}
 </form>
}
function DisputeResponseForm(){
 const [working,setWorking]=useState(false),[message,setMessage]=useState(""),[resolution,setResolution]=useState("merchant-accepted");
 async function send(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(working)return;const form=e.currentTarget,fields=new FormData(form);
  const raw=String(fields.get("amount")||"0");if(!/^\d{1,10}(?:\.\d{1,2})?$/.test(raw)){setMessage("Invalid NGN amount.");return;}
  const [whole,fraction=""]=raw.split(".");fields.set("amount_minor",String(Number(whole)*100+Number(fraction.padEnd(2,"0"))));
  fields.delete("amount");fields.set("confirm_resolution","true");if(resolution==="merchant-accepted")fields.delete("receipt");
  form.reset();setWorking(true);setMessage("");
  try{const result=await api.post<{case_id:string;state:string}>("/payments/admin/disputes/respond/",fields);
    setMessage("Dispute "+result.case_id+" · "+result.state+". Check supplier confirmation before another action.");
  }catch{setMessage("Response could not be qualified. Review the case before retrying.");}finally{setWorking(false)}
 }
 const field="mt-1 min-h-11 w-full rounded-lg border border-console-line px-3 text-sm";
 return <form onSubmit={send} className="space-y-2 rounded-lg border border-console-line p-3">
 <h4 className="text-sm font-medium">Respond to verified dispute</h4>
 <p className="text-xs text-console-muted">Only factual evidence may be submitted. Accepting a dispute may refund real money.</p>
 <label className="block text-xs">Verified review event ID<input name="event_id" required inputMode="numeric" pattern="[0-9]+" className={field}/></label>
 <label className="block text-xs">Resolution<select name="resolution" value={resolution} onChange={e=>setResolution(e.target.value)} className={field}><option value="merchant-accepted">Accept dispute</option><option value="declined">Decline with evidence</option></select></label>
 {resolution==="merchant-accepted"?<label className="block text-xs">Refund amount NGN<input name="amount" required inputMode="decimal" className={field}/></label>:<><label className="block text-xs">Receipt (PDF or JPEG, max 3 MB)<input name="receipt" type="file" accept=".pdf,.jpg,.jpeg" required className={field}/></label><label className="block text-xs">Factual service details (required for fraud claims)<textarea name="service_details" maxLength={2000} className={field}/></label></>}
 <label className="block text-xs">Reason<textarea name="message" required maxLength={500} className={field}/></label>
 <label className="block text-xs">Current password<input type="password" name="confirm_password" autoComplete="current-password" required className={field}/></label>
 <label className="block text-xs">Authenticator code<input name="totp_code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" className={field}/></label>
 <label className="flex gap-2 text-xs"><input type="checkbox" required/>I authorize this exact dispute response.</label>
 <button disabled={working} className="min-h-11 rounded-lg border border-console-line px-3 text-xs">{working?"Submitting…":"Authorize dispute response"}</button>
 {message?<p role="status" className="break-words text-xs">{message}</p>:null}
 </form>
}
function FinancialExceptionReview(){
 const [rows,setRows]=useState<ExceptionCase[]|null>(null),[error,setError]=useState(false),[loading,setLoading]=useState(false),[requests,setRequests]=useState<RefundRequest[]>([]),[canRefund,setCanRefund]=useState(false),[canDispute,setCanDispute]=useState(false);
 async function refresh(){setLoading(true);setError(false);try{const r=await api.get<{cases:ExceptionCase[];requests:RefundRequest[];refund_execution_enabled:boolean;dispute_resolution_enabled:boolean}>("/payments/admin/financial-exceptions/");setRows(r.cases);setRequests(r.requests);setCanRefund(r.refund_execution_enabled);setCanDispute(r.dispute_resolution_enabled)}catch{setError(true);setRows(null);setRequests([]);setCanRefund(false);setCanDispute(false)}finally{setLoading(false)}}
 return <section className="space-y-2 rounded-lg border border-console-line p-3">
  <h4 className="text-sm font-medium">Financial exception review</h4>
  <p className="text-xs text-console-muted">Verified refund, dispute and payment exception evidence. No money is moved from this view.</p>
  <button type="button" disabled={loading} onClick={()=>void refresh()} className="min-h-10 rounded-lg border border-console-line px-3 text-xs">{loading?"Loading…":"Load financial cases"}</button>
  {error?<p role="alert" className="text-xs text-rose-700">Review unavailable.</p>:null}
  {canRefund?<RefundRequestForm/>:null}
  {canDispute?<DisputeResponseForm/>:null}
  {requests.map(x=><p key={x.reference} className="break-words text-xs">Refund {x.reference} · {x.state} · NGN {(x.amount_minor/100).toFixed(2)}</p>)}
  {rows?.length===0?<p className="text-xs text-console-muted">No recorded live cases.</p>:null}
  {rows?.map(row=><div key={row.id} className="break-words rounded-lg border border-console-line p-2 text-xs"><p className="font-medium">{row.event} · Event {row.id}</p><p>{row.state.replaceAll("_"," ")} · {new Date(row.created_at).toLocaleString("en-GB")}</p>{row.case?<p>Provider case {row.case.case_id} · {row.case.state}{row.case.amount_minor!==null&&row.case.currency?" · "+row.case.currency+" "+(row.case.amount_minor/100).toFixed(2):""}</p>:null}</div>)}
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
