import Link from "next/link";
import {ArrowUpRight, Eye, EyeOff, Wallet} from "lucide-react";

import {WorkspaceWelcomePanel} from "@/components/data/WorkspaceWelcomePanel";

export function ClientHero({name,balance,balanceVisible,onToggleBalance}:{
 name:string;balance:string;balanceVisible:boolean;onToggleBalance:()=>void;
}){
 const Icon=balanceVisible?EyeOff:Eye;
 return <header className="relative isolate overflow-hidden rounded-3xl bg-[#123bc4] px-5 py-6 text-white sm:px-8 sm:py-8">
  <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,auto)] lg:items-center">
   <WorkspaceWelcomePanel name={name} audience="client" accent/>
   <div className="min-w-0 rounded-2xl border border-white/25 bg-white/10 p-4 sm:p-5">
    <p className="flex items-center gap-2 text-sm text-white"><Wallet aria-hidden="true" size={18}/> Available wallet balance</p>
    <div className="mt-1 flex items-center gap-2">
     <p className="min-w-0 break-words text-2xl font-medium tabular-nums tracking-tight sm:text-3xl">{balance}</p>
     <button type="button" aria-label={balanceVisible?"Hide wallet balance":"Show wallet balance"} aria-pressed={balanceVisible}
      onClick={onToggleBalance} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
      <Icon aria-hidden="true" size={19}/>
     </button>
    </div>
    <Link href="/client/wallet" className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-blue-900 hover:bg-blue-50">
     View wallet <ArrowUpRight aria-hidden="true" size={16}/>
    </Link>
   </div>
  </div>
 </header>;
}
