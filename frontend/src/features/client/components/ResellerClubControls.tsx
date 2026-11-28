"use client";
import {useState,useEffect} from "react";
import {Panel} from "@/components/design-system/Panel";
import {invoiceCheckoutHref} from "./commerce/invoice-links";
type State={available:boolean;auto_renew:boolean;registrant_verification:string;nameservers:string[];nameserver_state:string};
export function ResellerClubControls({domainId,mode}:{domainId:string;mode:string}){
 const url="/api/cloud/domains/domains/"+encodeURIComponent(domainId)+"/registrar-lifecycle/";
 const [state,setState]=useState<State>(),[password,setPassword]=useState(""),[ns,setNs]=useState(""),[code,setCode]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function refresh(){const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw Error();const s:State=await r.json();setState(s);setNs(s.nameservers.join("\n"))}
 useEffect(()=>{void refresh().catch(()=>setMessage("Registrar authority unavailable."));return()=>setCode("")},[url]);
 async function act(operation:string,extra:Record<string,unknown>={}){
  if(busy||!password)return;setBusy(true);setCode("");setMessage("");
  try{const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({operation,password,...extra}),cache:"no-store"});setPassword("");if(!r.ok)throw Error();const data=await r.json();if(data.auth_code)setCode(data.auth_code);else if(data.invoice_public_id)window.location.assign(invoiceCheckoutHref(data.invoice_public_id));else {setMessage(data.state==="uncertain"?"Change submitted; awaiting supplier confirmation.":"Request recorded.");await refresh();}}
  catch{setMessage("Unable to confirm. Do not repeat an uncertain supplier change.");}finally{setPassword("");setBusy(false)}
 }
 return <Panel><h3 className="font-medium">Registrar management</h3>{state?.available?<div className="mt-3 space-y-3 text-sm">
 <p>Registrant verification: {state.registrant_verification}</p>
 <label className="block">Confirm current account password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="block w-full rounded border p-2"/></label>
 {mode==="nameservers"?<><label className="block">Nameservers (one per line)<textarea className="block w-full rounded border p-2" value={ns} onChange={e=>setNs(e.target.value)}/></label><p>Change state: {state.nameserver_state}</p><button disabled={busy||!password||state.nameserver_state==="uncertain"} className="rounded border p-2" onClick={()=>void act("nameservers",{nameservers:ns.split(/\s+/).filter(Boolean)})}>Submit nameservers</button></>:mode==="renewal"?<><p>Automatic renewal invoices: {state.auto_renew?"Enabled":"Disabled"}. No automatic card charge.</p><button disabled={busy||!password} className="rounded border p-2" onClick={()=>void act("auto-renew",{enabled:!state.auto_renew})}>{state.auto_renew?"Disable":"Enable"} automatic renewal invoices</button><button disabled={busy||!password} className="ml-2 rounded border p-2" onClick={()=>void act("renew")}>Create renewal invoice</button></>:<><button disabled={busy||!password} className="rounded border p-2" onClick={()=>void act("resend-verification")}>Resend verification email</button><button disabled={busy||!password} className="ml-2 rounded border p-2" onClick={()=>void act("auth-code")}>Reveal transfer code</button>{code?<p className="break-all">Transfer code: <strong>{code}</strong> <button onClick={()=>setCode("")}>Hide</button></p>:null}</>}
 <button className="block underline" onClick={()=>void refresh().catch(()=>setMessage("Refresh unavailable."))}>Refresh registrar status</button></div>:null}{message?<p role="status" className="mt-2 text-sm">{message}</p>:null}</Panel>
}
