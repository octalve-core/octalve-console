import {Globe} from "lucide-react";
import {ConsoleIconTile} from "@/components/design-system/ConsoleIconTile";
import {Panel} from "@/components/design-system/Panel";
import {formatDomainPrice,type PublishedDomainPrice} from "./domain-types";

const tones = ["blue","violet","green","amber","cyan","rose"] as const;

export function PublishedDomainCatalogue({prices,currency,onSelect}:{
 prices:PublishedDomainPrice[];currency:string;onSelect:(tld:string)=>void;
}){
 return <section aria-labelledby="published-extensions-title" className="space-y-3">
  <h2 id="published-extensions-title" className="text-console-section font-medium">Published extensions</h2>
  <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
   {prices.map((price,index)=>{
    const tone=tones[index%tones.length];
    return <Panel key={price.tld} tone={tone} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
       <ConsoleIconTile icon={Globe} tone={tone} size="sm"/>
       <h3 className="min-w-0 break-all text-base font-medium">{price.tld}</h3>
      </div>
      <p className="break-words text-base font-medium tabular-nums">{formatDomainPrice(price.registration_price,currency)} <span className="text-xs">/ first year</span></p>
      {Number(price.renewal_price)>0 && <p className="text-xs leading-5">Renews at {formatDomainPrice(price.renewal_price,currency)} / year</p>}
      <button type="button" onClick={()=>onSelect(price.tld)} className="mt-auto inline-flex min-h-11 self-start items-center rounded-lg px-2 text-sm font-medium underline underline-offset-4 hover:bg-white/60">Search {price.tld}</button>
    </Panel>;
   })}
  </div>
 </section>;
}
