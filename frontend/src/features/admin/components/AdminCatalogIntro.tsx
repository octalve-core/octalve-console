import {Info,ServerCog,ShieldCheck} from "lucide-react";
import {Panel} from "@/components/design-system/Panel";
export function AdminCatalogIntro(){
 return <Panel className="flex min-w-0 items-start gap-3">
  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-console-primary">
   <ServerCog className="h-5 w-5"/>
  </span>
  <div className="min-w-0">
   <h2 className="flex items-center gap-2 text-sm font-medium text-console-ink">
    <ShieldCheck aria-hidden="true" className="h-4 w-4 text-console-primary"/>
    Verified supplier and retail offers
   </h2>
   <p className="mt-2 text-sm leading-6 text-console-muted">
    Review supplier inventory, approved costs and billing cycles before publishing offers.
    Publishing does not collect money or activate hosting.
   </p>
   <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-console-muted">
    <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0"/>
    Provider connections are checked against the server-side HTTPS allowlist.
   </p>
  </div>
 </Panel>;
}
