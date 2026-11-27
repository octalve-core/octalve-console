"use client";
import {useCallback,useEffect,useState} from "react";
import {Fingerprint,RefreshCw,ShieldCheck} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {api} from "@/lib/api/client";
type RecordItem={id:number;created_at:string;revoked_at:string|null;last_used_at:string|null;verified_logins:number;current_session:boolean};
type State={enrollment_enabled:boolean;enforcement_required:boolean;active_count:number;verified_active_count:number;records:RecordItem[]};
const displayDate=(value:string|null)=>value?new Date(value).toLocaleString():"Not yet verified";
export function PrivilegedPasskeyPanel(){
  const [state,setState]=useState<State|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{setState(await api.get<State>("/auth/passkeys/"));}
    catch{setState(null);setError("Passkey status could not be verified. Try refreshing.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  return <Panel className="space-y-4 xl:col-span-2">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3"><Fingerprint aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-console-primary"/>
        <div><h2 className="text-base font-medium text-console-ink">Security &amp; passkeys</h2><p className="text-sm text-console-muted">Your registered privileged authentication credentials.</p></div></div>
      <button type="button" onClick={()=>void load()} disabled={loading} aria-label="Refresh passkey status" className="min-h-11 rounded-lg border border-console-line px-3 text-sm disabled:opacity-50"><RefreshCw aria-hidden="true" className="h-4 w-4"/></button>
    </div>
    {loading?<p role="status" className="text-sm text-console-muted">Checking passkey status…</p>:error?<p role="alert" className="text-sm text-rose-700">{error}</p>:state?<>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-console-line p-3"><p className="text-xs text-console-muted">Active credentials</p><p className="text-xl font-medium">{state.active_count}</p></div>
        <div className="rounded-xl border border-console-line p-3"><p className="text-xs text-console-muted">Verified credentials</p><p className="text-xl font-medium">{state.verified_active_count}</p></div>
      </div>
      <p className="text-sm"><ShieldCheck aria-hidden="true" className="mr-1 inline h-4 w-4"/> {state.enforcement_required?"Passkey required":state.enrollment_enabled?"Enrollment only — password login remains available":"Enrollment disabled"}</p>
      <p className="text-sm text-console-muted">{state.verified_active_count>=2?"Two or more credentials have successful sign-ins. Physical independence still requires operator confirmation.":"Independent backup not yet verified. Register and test a separate authenticator."}</p>
      <div className="divide-y divide-console-line rounded-xl border border-console-line">
      {state.records.length===0?<p className="p-3 text-sm text-console-muted">No registered credentials.</p>:state.records.map(record=><div key={record.id} className="space-y-1 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">Passkey #{record.id}</p><span className="text-xs text-console-muted">{record.revoked_at?"Revoked":record.current_session?"Active · This session":"Active"}</span></div>
        <p className="text-console-muted">Registered: {displayDate(record.created_at)}</p><p className="text-console-muted">Last verified: {displayDate(record.last_used_at)}</p>
        {record.revoked_at?<p className="text-console-muted">Revoked: {displayDate(record.revoked_at)}</p>:null}
      </div>)}
      </div>
      <div className="rounded-xl border border-console-line p-3 text-sm"><p className="font-medium">Enrollment, replacement and revocation</p><p className="mt-1 text-console-muted">Contact your authorized security operator for an independently approved, account-bound grant or credential revocation. Use a separate signed-out browser for setup. Never share setup codes, passwords or passkeys. The final active verified credential cannot be removed through the normal revocation procedure.</p></div>
    </>:null}
  </Panel>;
}
