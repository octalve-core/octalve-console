import Link from "next/link";
import {ArrowRight} from "lucide-react";
import type {Integration} from "./catalog";
import {ProviderLogo} from "./ProviderLogo";
import type {DraftConnection} from "./connection-readback";
export function ProviderCard({item,drafts,overviewStatus="ready"}:{item:Integration;drafts:readonly DraftConnection[];overviewStatus?:"loading"|"ready"|"unavailable"}){
 return <li><Link href={"/admin/integrations?provider="+encodeURIComponent(item.slug)} scroll={false} aria-label={"View "+item.name+" connection requirements"}
 className="group flex h-full min-h-52 min-w-0 flex-col gap-3 rounded-2xl border border-console-line bg-white p-4 hover:border-blue-300 hover:bg-blue-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-console-primary">
 <div className="flex items-start justify-between gap-2"><ProviderLogo item={item}/>
  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">{drafts.some(c=>c.state==="draft")?"Draft saved":drafts.some(c=>c.state==="revoked")?"Revoked":overviewStatus==="unavailable"?"Status unavailable":overviewStatus==="loading"?"Checking status":"Not connected"}</span></div>
 <div><h3 className="text-sm font-semibold text-console-ink">{item.name}</h3>
  <p className="mt-2 text-xs leading-5 text-console-muted">{item.summary}</p></div>
 <span className="mt-auto inline-flex items-center gap-2 text-xs font-semibold text-console-primary">Connection requirements<ArrowRight aria-hidden="true" className="h-4 w-4"/></span>
 </Link></li>;
}
