import Link from "next/link";
import {ArrowRight,Eye,EyeOff} from "lucide-react";
import {WorkspaceWelcomePanel} from "@/components/data/WorkspaceWelcomePanel";
import {navigationIcons} from "@/features/shell/lib/navigation-icons";

export function ClientHero({name,balance,balanceVisible,onToggleBalance}:{
 name:string;balance:string;balanceVisible:boolean;onToggleBalance:()=>void;
}){
 const VisibilityIcon=balanceVisible?EyeOff:Eye;
 const WalletIcon=navigationIcons.walletCards;
 return <section className="rounded-3xl bg-[#123bc4] px-5 py-6 text-white shadow-console-surface sm:px-8 sm:py-8">
   <WorkspaceWelcomePanel name={name} audience="client" accent/>
   <div className="mt-6 flex min-w-0 flex-wrap items-end justify-between gap-3 sm:gap-5">
    <div className="min-w-0">
     <p className="flex items-center gap-2 text-xs text-blue-100">
      <WalletIcon size={17} strokeWidth={1.9} aria-hidden="true"/> Available wallet balance
     </p>
     <div className="mt-1 flex items-center gap-2">
      <p className="min-w-0 break-words text-3xl font-medium tabular-nums tracking-tight sm:text-4xl">{balance}</p>
      <button type="button" aria-label={balanceVisible?"Hide wallet balance":"Show wallet balance"} aria-pressed={balanceVisible}
       onClick={onToggleBalance} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
       <VisibilityIcon size={19} strokeWidth={1.9} aria-hidden="true"/>
      </button>
     </div>
    </div>
    <Link href="/client/wallet" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-medium text-blue-900 hover:bg-blue-50">
     View wallet <ArrowRight aria-hidden="true" size={16} strokeWidth={1.9}/>
    </Link>
   </div>
 </section>;
}
