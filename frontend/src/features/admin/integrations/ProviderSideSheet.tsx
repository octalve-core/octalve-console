"use client";
import {useEffect,useRef} from "react";
import {X} from "lucide-react";
import type {Integration} from "./catalog";
import {ProviderLogo} from "./ProviderLogo";
import {ProviderRequirements} from "./ProviderRequirements";
import type {DraftConnection} from "./connection-readback";
export function ProviderSideSheet({item,onClose,drafts,draftSchemaAvailable}:{item:Integration;onClose:()=>void;drafts:readonly DraftConnection[];draftSchemaAvailable:boolean}){
 const element=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=element.current;if(dialog&&!dialog.open)dialog.showModal();return ()=>{if(dialog?.open)dialog.close();};},[item.slug]);
 return <dialog ref={element} onClose={onClose} aria-labelledby="integration-sheet-title"
  className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-[38rem] border-0 bg-white p-0 text-console-ink shadow-2xl backdrop:bg-slate-950/55">
 <div className="flex h-full min-h-0 flex-col">
 <header className="flex shrink-0 items-center justify-between gap-3 border-b border-console-line px-5 py-4 sm:px-6">
  <div className="flex min-w-0 items-center gap-3"><ProviderLogo item={item}/><div className="min-w-0">
   <p className="text-xs text-console-muted">{item.category}</p>
   <h2 id="integration-sheet-title" className="truncate text-lg font-semibold">{item.name}</h2>
  </div></div>
  <button type="button" aria-label="Close integration details" onClick={()=>element.current?.close()}
   className="rounded-lg border border-console-line p-2 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary"><X className="h-5 w-5"/></button>
 </header>
 <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
  <div className="rounded-xl bg-blue-50 p-4">
   <p className="text-sm font-semibold">Prepare your connection</p>
   <p className="mt-1 text-xs leading-5 text-slate-700">Review what you need and follow the official setup guide. Secure credential entry is not yet available on this screen.</p>
  </div>
  {drafts.length?<section aria-label="Saved connection drafts" className="space-y-3">
   <h3 className="text-sm font-semibold">Your saved drafts</h3>
   {drafts.map(c=><div key={c.id} className="rounded-xl border border-console-line bg-slate-50 p-3">
    <p className="text-sm font-medium">{c.label}</p>
    <p className="mt-1 text-xs text-console-muted">{c.environment==="test"?"Test":"Live"} configuration · Credential version {c.credential_version} · {c.state==="draft"?"Unverified draft":"Revoked"}</p>
   </div>)}
   <p className="text-xs text-console-muted">Saved encrypted credentials are not a verified connection. No supplier activity is enabled.</p>
  </section>:null}
  {draftSchemaAvailable?<p className="rounded-xl border border-console-line bg-slate-50 p-3 text-xs text-console-muted">A restricted draft-storage schema exists for this provider. Credential submission remains unavailable until the security approval gate.</p>:null}
  <ProviderRequirements item={item}/>
 </div>
 <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-console-line px-5 py-4 sm:px-6">
  <span className="text-xs text-console-muted">Supplier execution disabled</span>
  <button type="button" onClick={()=>element.current?.close()} className="min-h-11 rounded-xl bg-console-primary px-5 py-2 text-sm font-semibold text-white">Done</button>
 </footer>
 </div></dialog>;
}
