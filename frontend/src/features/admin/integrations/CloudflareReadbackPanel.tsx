"use client";
import {useState} from "react";
import {CheckCircle2,ShieldAlert,ShieldCheck} from "lucide-react";
import {api} from "@/lib/api/client";

type Readback={provider:"cloudflare";scope:"dns"|"sandbox";verified:true;
 sandbox_only:boolean;execution_enabled:false;checked_at:string;
 evidence:Record<string,unknown>};
function valid(value:unknown,scope:"dns"|"sandbox"):value is Readback{
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const v=value as Partial<Readback>;
 return v.provider==="cloudflare"&&v.scope===scope&&v.verified===true&&
  v.execution_enabled===false&&typeof v.checked_at==="string"&&
  !!v.evidence&&typeof v.evidence==="object"&&!Array.isArray(v.evidence);
}
export function CloudflareReadbackPanel(){
 const [loading,setLoading]=useState<"dns"|"sandbox"|null>(null);
 const [result,setResult]=useState<Readback|null>(null);
 const [error,setError]=useState("");
 const [lastScope,setLastScope]=useState<"dns"|"sandbox"|null>(null);
 async function verify(scope:"dns"|"sandbox"){
  if(loading)return;
  setLoading(scope);setLastScope(scope);setResult(null);setError("");
  try{
   const reply=await api.get<unknown>("/providers/int01/cloudflare/probe/",{params:{scope}});
   if(!valid(reply,scope))throw Error("Unrecognized supplier response");
   setResult(reply);
  }catch{
   setError("This provider could not be verified. A Super Admin must configure the approved backend-only token, account and readback flag.");
  }finally{setLoading(null);}
 }
 return <section aria-label="Live read-only connection verification" className="rounded-xl border border-console-line p-4">
  <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-console-primary" aria-hidden="true"/>
   <h3 className="text-sm font-medium text-console-ink">Verify Cloudflare connection</h3></div>
  <p className="mt-2 text-xs leading-5 text-console-muted">
   Uses an authenticated, read-only Cloudflare request from the backend. No token is entered or exposed here.
   This does not register domains, change DNS or enable supplier execution.</p>
  <div className="mt-3 flex flex-wrap gap-2">
   <button type="button" disabled={Boolean(loading)} onClick={()=>verify("dns")}
    className="min-h-11 rounded-lg border border-console-line px-3 py-2 text-xs font-medium text-console-primary disabled:opacity-50">Verify owned DNS zone</button>
   <button type="button" disabled={Boolean(loading)} onClick={()=>verify("sandbox")}
    className="min-h-11 rounded-lg border border-console-line px-3 py-2 text-xs font-medium text-console-primary disabled:opacity-50">Verify Registrar Sandbox</button>
  </div>
  {loading?<p role="status" className="mt-2 text-xs text-console-muted">Checking with Cloudflare…</p>:null}
  {error?<p role="alert" className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-800"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/>{error}</p>:null}
  {result&&lastScope?<div role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-emerald-900">
   <p className="flex items-center gap-2 text-xs font-medium"><CheckCircle2 className="h-4 w-4" aria-hidden="true"/>Authenticated {lastScope==="dns"?"DNS zone":"Registrar Sandbox"} readback verified</p>
   <p className="mt-1 text-xs">Checked {new Date(result.checked_at).toLocaleString("en-GB")} · Supplier execution disabled</p>
   <p className="mt-1 text-xs">{lastScope==="dns"?"Verified DNS records: "+String(result.evidence.dns_record_count??"unavailable"):
     "Sandbox records on this response page: "+String(result.evidence.sandbox_registration_count_page??"unavailable")}</p>
  </div>:null}
 </section>;
}
