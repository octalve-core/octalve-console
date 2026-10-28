"use client";
import {useState} from "react";
import {ActionButton} from "@/components/design-system/ActionButton";
import {clientApi} from "@/lib/api/endpoints";

type State="idle"|"sending"|"requested"|"error";

export function ServiceCancellationRequest({serviceId,serviceStatus}:{serviceId:string;serviceStatus:string}){
 const [state,setState]=useState<State>("idle");
 const [expanded,setExpanded]=useState(false);
 const [message,setMessage]=useState("");
 if(!["active","suspended"].includes(serviceStatus))return null;
 async function submit(){
  if(state==="sending"||state==="requested")return;
  setState("sending");setMessage("");
  try{
   const result=await clientApi.requestServiceCancellation(serviceId);
   if(result?.state!=="pending_review"||result.provider_action_taken!==false)
    throw new Error("The review request could not be confirmed.");
   setState("requested");setExpanded(false);
  }catch{
   setState("error");
   setMessage("We couldn't confirm the review request. Please contact support before trying again.");
  }
 }
 return <section aria-label="Cancellation review" className="mt-5 rounded-xl border border-console-line p-4">
  <h3 className="text-sm font-semibold text-console-ink">Request cancellation review</h3>
  <p className="mt-2 text-sm leading-6 text-console-muted">
   You can ask our team to review a cancellation. Your hosting, invoices and access remain unchanged until the required checks and a confirmed provider action are completed.
  </p>
  {state==="requested"?<p role="status" className="mt-3 text-sm font-semibold text-console-primary">
   Your request is awaiting review. Your service has not been cancelled.
  </p>:null}
  {state!=="requested"&&!expanded?<ActionButton type="button" size="sm" variant="outline"
    onClick={()=>setExpanded(true)}>Request a review</ActionButton>:null}
  {expanded?<div className="mt-4 space-y-3">
   <p className="text-sm font-medium text-console-ink">Confirm you want to request a cancellation review. This will not cancel your service.</p>
   <div className="flex flex-wrap gap-2">
    <ActionButton type="button" disabled={state==="sending"} onClick={()=>{void submit();}}>
      {state==="sending"?"Submitting…":"Confirm review request"}
    </ActionButton>
    <ActionButton type="button" disabled={state==="sending"} variant="outline"
      onClick={()=>{setExpanded(false);setMessage("");setState("idle");}}>Keep my service</ActionButton>
   </div>
  </div>:null}
  {message?<p role="alert" className="mt-3 text-sm text-rose-700">{message}</p>:null}
 </section>;
}
