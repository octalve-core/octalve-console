import {ExternalLink,KeyRound,ShieldCheck} from "lucide-react";
import type {Integration} from "./catalog";
export function ProviderRequirements({item}:{item:Integration}){
 return <div className="space-y-6">
  <section><h3 className="text-sm font-medium text-console-ink">Connection requirements</h3>
  <ol className="mt-3 space-y-2">{item.requirements.map((f,i)=><li key={f.label} className="rounded-xl border border-console-line bg-slate-50 p-3">
   <div className="flex items-center gap-2"><span className="text-xs font-medium text-console-primary">{i+1}.</span>
    <span className="text-sm font-medium text-console-ink">{f.label}</span>
    {f.sensitive?<KeyRound aria-label="Sensitive credential" className="ml-auto h-4 w-4 text-console-muted"/>:null}</div>
   <p className="mt-1 pl-5 text-xs leading-5 text-console-muted">{f.guidance}</p>
  </li>)}</ol></section>
  <section><h3 className="text-sm font-medium text-console-ink">Capabilities and limitations</h3>
   <ul className="mt-3 space-y-2">{item.capabilities.map(value=><li key={value} className="flex gap-2 text-xs leading-5 text-console-muted">
    <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-console-primary"/>{value}</li>)}</ul></section>
  <a href={item.documentation} target="_blank" rel="noopener noreferrer"
   className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-console-line px-4 py-3 text-sm font-medium text-console-primary hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
    {item.guide}<ExternalLink aria-hidden="true" className="h-4 w-4"/><span className="sr-only">(opens vendor documentation in a new tab)</span></a>
 </div>;
}
