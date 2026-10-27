"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Award,X} from "lucide-react";
import {clientApi,type CustomerRewardOverview} from "@/lib/api/endpoints";
export function ClientRecognitionBanner(){
 const [recognitions,setRecognitions]=useState<CustomerRewardOverview["recognition"]>([]);
 const [error,setError]=useState("");
 useEffect(()=>{
  let mounted=true;
  clientApi.rewards().then(r=>{if(mounted)setRecognitions(r.recognition||[]);})
   .catch(()=>{ /* Disabled financial feature must not interfere with dashboard login. */});
  return()=>{mounted=false;};
 },[]);
 const item=recognitions[0];
 if(!item)return null;
 async function dismiss(){
  try{
   const res=await clientApi.dismissRecognition(item.id);
   if(!res.dismissed)throw Error("Not dismissed");
   setRecognitions(current=>current.filter(r=>r.id!==item.id));
  }catch{setError("Couldn't dismiss this thank-you. Please try again.");}
 }
 return <section aria-label="Private customer appreciation"
  className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
  <div className="flex items-start gap-3">
   <Award aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-console-primary"/>
   <div className="min-w-0 flex-1">
    <h2 className="text-base font-semibold text-console-ink">{item.title}</h2>
    <p className="mt-1 text-sm leading-6 text-console-muted">{item.message}</p>
    <Link href="/client/rewards" className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-console-primary">
      My rewards
    </Link>
   </div>
   <button type="button" aria-label="Dismiss appreciation" onClick={()=>void dismiss()}
    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-console-muted hover:bg-slate-100">
    <X className="h-4 w-4" aria-hidden="true"/>
   </button>
  </div>
  {error?<p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>:null}
 </section>;
}
