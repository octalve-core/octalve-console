import {WalletCards} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
import {formatCurrency} from "@/lib/formatters";
export function WalletBalanceCard({balance,status}:{
 balance:number|null;status:"loading"|"ready"|"unavailable";
}){
 const label=status==="loading"?"…":balance===null?"—":formatCurrency(balance);
 return <Panel>
  <div className="flex min-w-0 items-start justify-between gap-3">
   <div className="min-w-0">
    <p className="text-sm font-medium text-console-muted">Available balance</p>
    <p aria-live="polite" className="mt-3 break-words text-3xl font-semibold text-console-ink">{label}</p>
    <p className="mt-3 text-sm text-console-muted">Verified wallet credit</p>
   </div>
   <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-console-primary">
    <WalletCards className="h-6 w-6"/>
   </span>
  </div>
 </Panel>;
}
