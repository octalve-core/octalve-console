import Link from "next/link";
import {Globe,Package,Plus,Trash2} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";

export function CartLine({name,detail,price,domain,registration,busy,onRemove}:{
  name:string;detail:string;price?:string;domain?:string;registration:boolean;busy:boolean;onRemove:()=>void;
}){
  const Icon=registration?Globe:Package;
  return <Panel className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-50 text-console-primary"><Icon size={19} aria-hidden="true"/></span>
        <div className="min-w-0">
          <h2 className="break-words text-base font-medium">{name}</h2>
          <p className="mt-1 break-words text-sm text-console-muted">{detail}</p>
          {!registration&&domain&&<p className="mt-1 break-words text-xs text-console-muted">{domain}</p>}
        </div>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {registration&&<p className="max-w-24 text-right text-xs text-console-muted">Priced at review</p>}
        {price&&<p className="text-sm font-medium tabular-nums">{price}<span className="block text-right text-xs font-normal text-console-muted">Estimated</span></p>}
        <button type="button" aria-label={`Remove ${name}`} disabled={busy} onClick={onRemove}
          className="grid size-11 place-items-center rounded-lg text-rose-700 hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-700 disabled:opacity-50">
          <Trash2 size={17} aria-hidden="true"/>
        </button>
      </div>
    </div>
    {registration&&domain&&<div className="border-t border-console-line pt-2">
      <Link href={`/client/order?forDomain=${encodeURIComponent(domain)}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-console-primary hover:bg-blue-50">
        <Plus size={16} aria-hidden="true"/> Add hosting
      </Link>
    </div>}
  </Panel>;
}
